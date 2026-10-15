// 게임 흐름: 로딩 → 닉네임 → 선물 선택 → 카운트다운 → 10초 탭 → 결과/랭킹/공유
import { Stage } from './scene.js';
import { GIFTS, giftById } from './items.js';
import { STAGES } from './wrapper.js';
import { LiveTracker, GRADES, RULES, calculate } from './scoring.js';
import { createApi, prefs, isUuid } from './api.js';
import { Sound } from './audio.js';
import { buildShareImage, shareResult, downloadBlob, challengeUrl } from './share.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NICK_RE = /^[가-힣a-zA-Z0-9_ ]{2,12}$/;
const pollMs = () => api?.pollMs ?? 5000; // 순위 자동 갱신 간격 (시트 모드는 20초)
const RING = 119.4;
// ?debug: 개발 확인용 (스크립트 탭 허용 + 내부 객체 노출). 서버는 항상 별도로 검증한다.
const DEBUG = new URLSearchParams(location.search).has('debug');

const state = {
  screen: 'loading', nickname: '', gift: GIFTS[0], gameId: null,
  duration: RULES.durationMs, target: RULES.targetTaps, tracker: null,
  playing: false, startAt: 0, completed: false, result: null,
  period: 'all', modalPeriod: 'all', pollTimer: null, modalTimer: null,
  shareBlob: null, snapshot: null, lastRanks: {},
};

let api;
let stage;
const sound = new Sound();

// ---------- 공통 UI ----------
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  state.screen = name;
  document.body.classList.toggle('playing', name === 'play');
  if (name !== 'result') stopPolling();
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function centerMessage(text, isMessage = false) {
  const c = $('countdown');
  c.classList.remove('pop');
  c.classList.toggle('message', isMessage);
  c.textContent = text;
  void c.offsetWidth; // 애니메이션 재시작
  c.classList.add('pop');
}

function floatText(text, x, y, color) {
  const f = el('div', 'float-text', text);
  f.style.left = `${x}px`;
  f.style.top = `${y}px`;
  if (color) f.style.color = color;
  $('float-layer').appendChild(f);
  setTimeout(() => f.remove(), 800);
}

function ripple(x, y) {
  const r = el('div', 'ripple');
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  $('float-layer').appendChild(r);
  setTimeout(() => r.remove(), 450);
}

function updateSoundBtn() {
  $('sound-toggle').textContent = sound.muted ? '🔇' : '🔊';
}

function renderBest() {
  const b = prefs.best;
  const badge = $('best-badge');
  badge.hidden = !b;
  badge.textContent = b ? `내 최고 ${b.toLocaleString('ko-KR')}점` : '';
}

// ---------- 닉네임 ----------
function validateNickname(raw) {
  const nick = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!NICK_RE.test(nick)) return { ok: false, msg: '한글/영문/숫자 2~12자로 입력해 주세요.' };
  return { ok: true, nick };
}

function onNickSubmit(e) {
  e.preventDefault();
  sound.unlock();
  const v = validateNickname($('nickname').value);
  if (!v.ok) { $('nick-error').textContent = v.msg; $('nickname').focus(); return; }
  $('nick-error').textContent = '';
  state.nickname = v.nick;
  prefs.nickname = v.nick;
  goSelect();
}

// ---------- 선물 선택 ----------
function renderGiftList() {
  const list = $('gift-list');
  list.replaceChildren();
  for (const g of GIFTS) {
    const b = el('button', 'gift-card');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.dataset.gift = g.id;
    b.append(el('span', 'emoji', g.emoji), el('span', 'name', g.name));
    b.addEventListener('click', () => selectGift(g.id));
    list.appendChild(b);
  }
}

function selectGift(id) {
  state.gift = giftById(id);
  document.querySelectorAll('.gift-card').forEach((c) => c.setAttribute('aria-selected', String(c.dataset.gift === id)));
  $('gift-name').textContent = `${state.gift.emoji} ${state.gift.name}`;
  $('gift-desc').textContent = state.gift.desc;
  stage.showcase(state.gift);
  sound.pop();
}

function goSelect() {
  show('select');
  stage.setMode('select');
  selectGift(state.gift.id);
  if (!sound.muted) sound.startMusic();
}

// ---------- 플레이 ----------
function resetHud() {
  $('tap-count').textContent = '0';
  $('progress-bar').style.width = '0%';
  $('progress-pct').textContent = '0%';
  $('stage-label').textContent = STAGES[0].label;
  $('speed-fill').style.width = '0%';
  $('speed-text').textContent = '초당 0회';
  $('combo').textContent = '';
  $('timer-text').textContent = (state.duration / 1000).toFixed(1);
  $('timer-ring').style.strokeDashoffset = '0';
  $('countdown').textContent = '';
  document.querySelector('.timer').classList.remove('danger');
  $('tap-hint').classList.remove('show');
}

async function startGame() {
  sound.unlock();
  sound.stopMusic();
  const btns = document.querySelectorAll('[data-action="start-game"], [data-action="retry"]');
  btns.forEach((b) => { b.disabled = true; });
  let res;
  try {
    res = await api.startGame(state.nickname, state.gift.id);
  } catch (e) {
    toast(e.message || '게임을 시작하지 못했어요.');
    if (['INVALID_NICKNAME', 'NICKNAME_NOT_ALLOWED', 'INVALID_INPUT'].includes(e.code)) {
      show('intro');
      stage.setMode('intro');
      $('nick-error').textContent = e.message;
    }
    return;
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
  state.gameId = res.gameId;
  state.duration = res.durationMs;
  state.target = res.targetTaps;
  state.tracker = new LiveTracker({ ...RULES, durationMs: res.durationMs, targetTaps: res.targetTaps });
  state.completed = false;
  state.result = null;
  state.shareBlob = null;

  stage.startWrap(state.gift, state.nickname);
  stage.setMode('play');
  stage.setEnergy(0);
  resetHud();
  $('tap-layer').classList.add('locked');
  show('play');

  await wait(500);
  for (const n of ['3', '2', '1']) {
    centerMessage(n);
    sound.beep(false);
    await wait(800);
  }
  centerMessage('시작!');
  sound.beep(true);
  $('tap-layer').classList.remove('locked');
  $('tap-hint').classList.add('show');
  state.playing = true;
  state.startAt = performance.now();
  requestAnimationFrame(hudLoop);
}

function onTap(e) {
  if (e.cancelable) e.preventDefault();
  if (!state.playing || (!e.isTrusted && !DEBUG)) return;
  const t = Math.round(performance.now() - state.startAt);
  if (t > state.duration) return;
  if (!state.tracker.add(t)) return;

  const n = state.tracker.count();
  const tps = state.tracker.tpsAt(t);
  const energy = Math.min(1, tps / 12);
  stage.setEnergy(energy);
  stage.setTarget(n / state.target);
  stage.tap(energy);
  sound.tap(state.tracker.combo);
  if (navigator.vibrate && e.isTrusted) navigator.vibrate(6);
  ripple(e.clientX, e.clientY);
  $('tap-hint').classList.remove('show');
  $('tap-count').textContent = String(n);

  const combo = state.tracker.combo;
  if (combo > 0 && combo % 10 === 0) floatText(`${combo} COMBO!`, e.clientX, e.clientY - 30, '#ffd76a');
  else if (state.completed) floatText('+BONUS', e.clientX, e.clientY - 20, '#ff9ab0');

  if (!state.completed && n >= state.target) {
    state.completed = true;
    stage.complete();
    sound.fanfare();
    centerMessage('포장 완성! 🎉\n보너스 타임!', true);
  }
}

function hudLoop() {
  if (!state.playing) return;
  const t = performance.now() - state.startAt;
  const remain = Math.max(0, state.duration - t);
  $('timer-text').textContent = (remain / 1000).toFixed(1);
  $('timer-ring').style.strokeDashoffset = String(RING * Math.min(1, t / state.duration));
  document.querySelector('.timer').classList.toggle('danger', remain < 3000);

  const tps = state.tracker.tpsAt(t);
  stage.setEnergy(Math.min(1, tps / 12));
  $('speed-fill').style.width = `${Math.min(100, (tps / 15) * 100)}%`;
  $('speed-text').textContent = `초당 ${tps}회`;
  const combo = state.tracker.comboAt(t);
  const comboEl = $('combo');
  const txt = combo >= 3 ? `${combo} COMBO` : '';
  if (comboEl.textContent !== txt) {
    comboEl.textContent = txt;
    comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump');
  }
  const pct = Math.min(100, Math.round((state.tracker.count() / state.target) * 100));
  $('progress-bar').style.width = `${pct}%`;
  $('progress-pct').textContent = `${pct}%`;

  if (t >= state.duration) { endGame(); return; }
  requestAnimationFrame(hudLoop);
}

function onStageChange(st, prev) {
  if (state.screen === 'play') $('stage-label').textContent = STAGES[st].label;
  if (st <= prev) return;
  if (st === 2 || st === 3 || st === 4 || st === 6) sound.crinkle();
  else sound.pop();
}

async function endGame() {
  state.playing = false;
  $('tap-layer').classList.add('locked');
  $('tap-hint').classList.remove('show');
  stage.setEnergy(0);
  sound.timeUp();
  centerMessage('TIME UP!', true);

  const taps = state.tracker.taps.slice();
  const submit = api.finishGame(state.gameId, taps).catch((e) => e);

  await wait(1200);
  if (!state.completed) {
    centerMessage('요정들이 마무리를\n도와줬어요 ✨', true);
    const from = state.tracker.count() / state.target;
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      stage.setTarget(from + (1 - from) * (i / steps));
      if (i % 4 === 0) stage.tap(0.3);
      await wait(70);
    }
    await wait(600);
    stage.complete();
    sound.fanfare();
    await wait(1600);
  } else {
    await wait(900);
  }

  let res = await submit;
  if (res instanceof Error) {
    toast(res.message || '순위 등록에 실패했어요.');
    let local;
    try { local = calculate(taps, { ...RULES, durationMs: state.duration, targetTaps: state.target }); } catch { local = calculate([]); }
    res = { gameId: null, nickname: state.nickname, gift: state.gift.id, result: local, allRank: null, todayRank: null };
  }
  state.result = res;
  state.snapshot = stage.capture();
  stage.setMode('result');
  renderResult(res);
  show('result');
  if (!sound.muted) sound.startMusic();
  startPolling();
}

// ---------- 결과 ----------
function setRank(id, rank) {
  const b = $(id);
  const totalEl = $(`${id}-total`);
  if (!rank) { b.textContent = '-'; totalEl.textContent = ''; return; }
  const prev = state.lastRanks[id];
  b.textContent = `${rank.rank.toLocaleString('ko-KR')}위`;
  totalEl.textContent = `/ ${rank.total.toLocaleString('ko-KR')}명`;
  if (prev && prev !== rank.rank) { b.classList.remove('changed'); void b.offsetWidth; b.classList.add('changed'); }
  state.lastRanks[id] = rank.rank;
}

function countUp(target) {
  const elx = $('score-value');
  const start = performance.now();
  const dur = 1400;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    elx.textContent = Math.round(target * e).toLocaleString('ko-KR');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderResult(res) {
  const r = res.result;
  const g = GRADES[r.grade] ?? GRADES.C;
  const badge = $('grade-badge');
  badge.textContent = r.grade;
  badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';
  $('grade-title').textContent = g.title;
  $('grade-desc').textContent = g.desc;
  countUp(r.score);
  const isBest = r.score > prefs.best;
  if (isBest) prefs.best = r.score;
  $('new-best').hidden = !isBest;
  renderBest();
  state.lastRanks = {};
  setRank('rank-all', res.allRank);
  setRank('rank-today', res.todayRank);
  $('st-taps').textContent = `${r.tapCount}회`;
  $('st-avg').textContent = `${r.avgTps}회/초`;
  $('st-peak').textContent = `${r.peakTps}회/초`;
  $('st-combo').textContent = `${r.maxCombo}`;
  $('st-steady').textContent = `${r.steadiness}%`;
  $('st-complete').textContent = r.completionMs != null ? `${(r.completionMs / 1000).toFixed(2)}초` : '도움 받음';
  document.querySelectorAll('#screen-result .tab').forEach((t) => t.classList.toggle('active', t.dataset.period === state.period));
  refreshBoard($('board-result'), state.period);
}

function renderBoard(list, board, myGameId, myRank) {
  list.replaceChildren();
  if (!board.entries.length) {
    const li = el('li');
    li.append(el('span', 'empty', '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!'));
    list.appendChild(li);
    return;
  }
  let mineShown = false;
  for (const e of board.entries) {
    const li = el('li');
    if (myGameId && e.gameId === myGameId) { li.classList.add('me'); mineShown = true; }
    li.append(
      el('span', 'rk', String(e.rank)),
      el('span', 'gf', giftById(e.gift).emoji),
      el('span', 'nm', e.nickname),
      el('span', 'sc', e.score.toLocaleString('ko-KR')),
    );
    list.appendChild(li);
  }
  if (myGameId && !mineShown && myRank && state.result) {
    const li = el('li', 'me');
    li.append(
      el('span', 'rk', String(myRank.rank)),
      el('span', 'gf', state.gift.emoji),
      el('span', 'nm', `${state.nickname} (나)`),
      el('span', 'sc', state.result.result.score.toLocaleString('ko-KR')),
    );
    list.appendChild(li);
  }
}

async function refreshBoard(list, period) {
  try {
    const board = await api.leaderboard(period, 20);
    const myRank = period === 'today' ? state.result?.todayRank : state.result?.allRank;
    renderBoard(list, board, list.id === 'board-result' ? state.result?.gameId : null, myRank);
  } catch {
    /* 폴링 중 일시 오류는 무시 */
  }
}

async function refreshMyRank() {
  if (!state.result?.gameId) return;
  try {
    const r = await api.rank(state.result.gameId);
    state.result.allRank = r.allRank;
    state.result.todayRank = r.todayRank;
    setRank('rank-all', r.allRank);
    setRank('rank-today', r.todayRank);
  } catch { /* 무시 */ }
}

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (document.hidden || state.screen !== 'result') return;
    refreshMyRank();
    refreshBoard($('board-result'), state.period);
  }, pollMs());
}

function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

// ---------- 공유 ----------
async function getShareBlob() {
  if (state.shareBlob) return state.shareBlob;
  const r = state.result;
  state.shareBlob = await buildShareImage({
    snapshot: state.snapshot,
    nickname: state.nickname,
    score: r.result.score,
    grade: r.result.grade,
    allRank: r.allRank,
    giftName: state.gift.name,
    tapCount: r.result.tapCount,
    peakTps: r.result.peakTps,
  });
  return state.shareBlob;
}

async function doShare() {
  if (!state.result) return;
  const r = state.result;
  const g = GRADES[r.result.grade] ?? GRADES.C;
  const rankTxt = r.allRank ? ` · 전체 ${r.allRank.rank}위` : '';
  const text = `🎁 컴패션 크리스마스 선물 포장 챌린지\n${state.nickname}님이 ${r.result.score.toLocaleString('ko-KR')}점 (${r.result.grade} ${g.title})${rankTxt}!\n나보다 빨리 포장할 수 있을까요?`;
  const url = r.gameId ? challengeUrl(r.gameId) : location.origin + location.pathname;
  let blob = null;
  try { blob = await getShareBlob(); } catch { /* 이미지 없이 링크만 */ }
  const out = await shareResult({ blob, text, url });
  if (out === 'copied') toast('공유 문구와 링크를 복사했어요! 친구에게 붙여넣어 보내 주세요.');
  else if (out === 'failed') toast('공유를 지원하지 않는 환경이에요. 이미지 저장을 이용해 주세요.');
}

async function doSaveImage() {
  if (!state.result) return;
  try {
    const blob = await getShareBlob();
    downloadBlob(blob, `compassion-gift-${state.result.result.score}.png`);
    toast('결과 이미지를 저장했어요!');
  } catch {
    toast('이미지를 만들지 못했어요.');
  }
}

async function loadChallenge() {
  const params = new URLSearchParams(location.search);
  const id = params.get('challenge');
  if (!id) return;
  history.replaceState(null, '', location.pathname);
  if (!isUuid(id)) return;
  try {
    const s = await api.share(id);
    const rank = s.allRank ? ` (현재 전체 ${s.allRank.rank}위)` : '';
    const banner = $('challenge-banner');
    banner.textContent = `🎯 ${s.nickname}님이 ${giftById(s.gift).name} 포장으로 ${s.score.toLocaleString('ko-KR')}점${rank}! 도전장을 보냈어요.`;
    banner.hidden = false;
  } catch { /* 존재하지 않는 기록이면 무시 */ }
}

// ---------- 랭킹 모달 ----------
function openRanking() {
  $('ranking-modal').hidden = false;
  const refresh = () => refreshBoard($('board-modal'), state.modalPeriod);
  refresh();
  clearInterval(state.modalTimer);
  state.modalTimer = setInterval(() => { if (!document.hidden) refresh(); }, pollMs());
}

function closeRanking() {
  $('ranking-modal').hidden = true;
  clearInterval(state.modalTimer);
}

// ---------- 이벤트 ----------
function bindEvents() {
  $('nick-form').addEventListener('submit', onNickSubmit);
  $('nickname').addEventListener('input', () => { $('nick-error').textContent = ''; });
  const layer = $('tap-layer');
  layer.addEventListener('pointerdown', onTap, { passive: false });
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  layer.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  const actions = {
    'open-ranking': openRanking,
    'close-ranking': closeRanking,
    'back-intro': () => { show('intro'); stage.setMode('intro'); },
    'start-game': startGame,
    retry: startGame,
    'choose-again': goSelect,
    share: doShare,
    'save-image': doSaveImage,
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    sound.unlock();
    actions[btn.dataset.action]?.();
  });

  document.querySelectorAll('#screen-result .tab').forEach((t) => t.addEventListener('click', () => {
    state.period = t.dataset.period;
    document.querySelectorAll('#screen-result .tab').forEach((x) => x.classList.toggle('active', x === t));
    refreshBoard($('board-result'), state.period);
  }));
  document.querySelectorAll('#ranking-modal .tab').forEach((t) => t.addEventListener('click', () => {
    state.modalPeriod = t.dataset.period;
    document.querySelectorAll('#ranking-modal .tab').forEach((x) => x.classList.toggle('active', x === t));
    refreshBoard($('board-modal'), state.modalPeriod);
  }));
  $('ranking-modal').addEventListener('click', (e) => { if (e.target.id === 'ranking-modal') closeRanking(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRanking(); });

  $('sound-toggle').addEventListener('click', () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    prefs.muted = sound.muted;
    updateSoundBtn();
    if (sound.muted) sound.stopMusic();
    else if (state.screen !== 'play') sound.startMusic();
  });
}

// ---------- 시작 ----------
async function boot() {
  try {
    stage = new Stage($('stage'));
  } catch {
    document.querySelector('#screen-loading p').textContent = '이 기기/브라우저에서는 3D 그래픽을 표시할 수 없어요.';
    return;
  }
  stage.onStageChange = onStageChange;
  if (DEBUG) window.__giftwrap = { stage, state, GIFTS };
  const [apiClient] = await Promise.all([createApi(), document.fonts?.ready]);
  api = apiClient;
  $('offline-note').hidden = !api.offline;
  sound.muted = prefs.muted;
  updateSoundBtn();
  $('nickname').value = prefs.nickname;
  renderBest();
  renderGiftList();
  bindEvents();
  $('nick-submit').disabled = false;
  await loadChallenge();
  stage.setMode('intro');
  show('intro');
}

boot();
