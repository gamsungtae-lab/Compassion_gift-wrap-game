/**
 * 컴패션 선물 포장 챌린지 — 랭킹 서버 (Google Apps Script 웹 앱)
 *
 * 구글 스프레드시트를 저장소로 쓰는 무료 백엔드. Spring 서버(GameService/ScoreCalculator)와 같은 규칙:
 *  - 서버가 발급한 게임 세션으로만 1회 제출, 본인 clientId 만 제출 가능
 *  - 서버 시각으로 플레이 시간 검증, 탭 기록으로 점수를 서버에서 재계산 (클라이언트 점수 불신)
 *  - 닉네임 허용 문자 검증 + 금칙어, 입력 길이/범위 제한, 오류 메시지에 내부 정보 미노출
 *
 * 시트
 *  - records : 완료된 모든 게임 기록 (운영자 열람용)
 *  - best    : 기간(ALL / yyyy-MM-dd)별 플레이어 최고 기록 → 순위표. 부적절한 기록은 이 시트에서 행 삭제
 *
 * 최초 1회: 편집기에서 setup() 실행 → 배포 > 새 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자)
 */

const CONFIG = {
  DURATION_MS: 10000,
  TARGET_TAPS: 60,
  MAX_TAPS: 250,
  MIN_INTERVAL_MS: 20,
  COMBO_WINDOW_MS: 250,
  PEAK_WINDOW_MS: 1000,
  SESSION_TTL_S: 120,
  TIME_ZONE: 'Asia/Seoul',
  BOARD_CACHE_S: 15,
  STARTS_PER_CLIENT_PER_MIN: 12,
  MAX_BODY_CHARS: 20000,
};

const DEFAULT_BANNED = ['시발', '씨발', '병신', '개새', '존나', '좆', 'fuck', 'shit', 'admin', '관리자', '운영자'];
const GIFTS = ['BEAR', 'SOCCER', 'BOOK', 'CRAYON', 'SCARF', 'SNOWGLOBE'];
const NICK_RE = /^[가-힣a-zA-Z0-9_ ]{2,12}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RECORD_HEADERS = ['gameId', 'clientId', 'nickname', 'gift', 'score', 'grade', 'tapCount', 'avgTps', 'peakTps',
  'maxCombo', 'steadiness', 'completionMs', 'startedAt', 'finishedAt', 'day'];
const BEST_HEADERS = ['period', 'clientId', 'gameId', 'nickname', 'gift', 'score', 'grade', 'achievedAt'];

// ---------------- 진입점 ----------------

function doGet(e) {
  return respond_(() => {
    const p = (e && e.parameter) || {};
    switch (p.action) {
      case 'leaderboard': return leaderboard_(p.period, p.limit);
      case 'rank': return rank_(p.gameId);
      case 'share': return share_(p.gameId);
      case 'ping': return { pong: true };
      default: throw apiError_('NOT_FOUND', '찾을 수 없어요.', 404);
    }
  });
}

function doPost(e) {
  return respond_(() => {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > CONFIG.MAX_BODY_CHARS) throw invalid_();
    let body;
    try { body = JSON.parse(raw); } catch (err) { throw invalid_(); }
    if (!body || typeof body !== 'object') throw invalid_();
    switch (body.action) {
      case 'start': return start_(body);
      case 'finish': return finish_(body);
      default: throw apiError_('NOT_FOUND', '찾을 수 없어요.', 404);
    }
  });
}

function respond_(fn) {
  let out;
  try {
    out = { ok: true, data: fn() };
  } catch (err) {
    if (err && err.apiCode) {
      out = { ok: false, error: err.apiCode, message: err.message, status: err.status };
    } else {
      console.error(err && err.stack ? err.stack : err);
      out = { ok: false, error: 'SERVER_ERROR', message: '잠시 문제가 생겼어요. 다시 시도해 주세요.', status: 500 };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(code, message, status) {
  const e = new Error(message);
  e.apiCode = code;
  e.status = status;
  return e;
}
function invalid_() { return apiError_('INVALID_INPUT', '입력값이 올바르지 않아요.', 400); }
function notFound_() { return apiError_('GAME_NOT_FOUND', '게임 기록을 찾을 수 없어요.', 404); }

// ---------------- 게임 ----------------

function start_(body) {
  const nickname = sanitizeNickname_(body.nickname);
  const clientId = requireUuid_(body.clientId);
  if (GIFTS.indexOf(body.gift) < 0) throw invalid_();

  const cache = CacheService.getScriptCache();
  const rlKey = 'rl:' + clientId;
  const count = Number(cache.get(rlKey) || 0) + 1;
  if (count > CONFIG.STARTS_PER_CLIENT_PER_MIN) {
    throw apiError_('TOO_MANY_REQUESTS', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', 429);
  }
  cache.put(rlKey, String(count), 60);

  const gameId = Utilities.getUuid().toLowerCase();
  cache.put('g:' + gameId, JSON.stringify({ clientId: clientId, nickname: nickname, gift: body.gift, startedAt: Date.now() }),
    CONFIG.SESSION_TTL_S + 60);
  return { gameId: gameId, durationMs: CONFIG.DURATION_MS, targetTaps: CONFIG.TARGET_TAPS };
}

function finish_(body) {
  const gameId = requireUuid_(body.gameId);
  const clientId = requireUuid_(body.clientId);
  const taps = body.taps;
  if (!Array.isArray(taps) || taps.length > 600) throw invalid_();
  for (let i = 0; i < taps.length; i++) {
    const t = taps[i];
    if (typeof t !== 'number' || !isFinite(t) || Math.floor(t) !== t || t < 0 || t > 60000) throw invalid_();
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw apiError_('BUSY', '참여자가 많아 잠시 지연되고 있어요. 다시 시도해 주세요.', 503);
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get('g:' + gameId);
    if (!raw) {
      if (findRecord_(gameId)) throw apiError_('ALREADY_FINISHED', '이미 제출된 게임이에요.', 409);
      throw apiError_('EXPIRED', '게임 시간이 만료되었어요. 다시 시작해 주세요.', 410);
    }
    const session = JSON.parse(raw);
    if (session.clientId !== clientId) throw notFound_();
    cache.remove('g:' + gameId); // 1회만 제출 가능

    const now = Date.now();
    const elapsed = now - session.startedAt;
    if (elapsed > CONFIG.SESSION_TTL_S * 1000) throw apiError_('EXPIRED', '게임 시간이 만료되었어요. 다시 시작해 주세요.', 410);
    if (elapsed < CONFIG.DURATION_MS) throw apiError_('INVALID_TIMING', '게임 기록이 올바르지 않아요.', 422);

    const r = calculate_(taps);
    const day = dayKey_(session.startedAt);
    sheet_('records').appendRow([txt_(gameId), txt_(clientId), txt_(session.nickname), session.gift, r.score, r.grade, r.tapCount, r.avgTps,
      r.peakTps, r.maxCombo, r.steadiness, r.completionMs === null ? '' : r.completionMs,
      new Date(session.startedAt), new Date(now), txt_(day)]);
    updateBest_('ALL', clientId, gameId, session, r, now);
    updateBest_(day, clientId, gameId, session, r, now);
    invalidateBoards_(day);

    return {
      gameId: gameId, nickname: session.nickname, gift: session.gift, result: r,
      allRank: rankOf_('ALL', r.score), todayRank: rankOf_(day, r.score),
    };
  } finally {
    lock.releaseLock();
  }
}

function rank_(gameId) {
  const rec = findRecord_(requireUuid_(gameId));
  if (!rec) throw notFound_();
  return { allRank: rankOf_('ALL', rec.score), todayRank: rankOf_(rec.day, rec.score) };
}

function share_(gameId) {
  const rec = findRecord_(requireUuid_(gameId));
  if (!rec) throw notFound_();
  return {
    nickname: rec.nickname, gift: rec.gift, score: rec.score, grade: rec.grade,
    tapCount: rec.tapCount, peakTps: rec.peakTps, allRank: rankOf_('ALL', rec.score),
  };
}

// ---------------- 순위 ----------------

function leaderboard_(period, limit) {
  if (period !== undefined && period !== 'all' && period !== 'today') throw invalid_();
  const n = limit === undefined ? 20 : Number(limit);
  if (!(Math.floor(n) === n && n >= 1 && n <= 50)) throw invalid_();
  const key = period === 'today' ? dayKey_(Date.now()) : 'ALL';
  const board = board_(key);
  return {
    period: period === 'today' ? 'today' : 'all',
    total: board.total,
    entries: board.top.slice(0, n),
    updatedAt: new Date().toISOString(),
  };
}

function rankOf_(key, score) {
  const scores = board_(key).scores; // 내림차순
  let lo = 0, hi = scores.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (scores[mid] > score) lo = mid + 1; else hi = mid; }
  return { rank: lo + 1, total: scores.length };
}

/** 기간별 순위표 (짧게 캐시해 시트 읽기 횟수를 줄임) */
function board_(key) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('board:' + key);
  if (hit) return JSON.parse(hit);
  const rows = readRows_('best', BEST_HEADERS.length).filter(function (r) { return periodOf_(r[0]) === key; });
  rows.sort(function (a, b) { return Number(b[5]) - Number(a[5]) || toTime_(a[7]) - toTime_(b[7]); });
  const top = [];
  let rank = 0, prev = null;
  for (let i = 0; i < rows.length && i < 50; i++) {
    const r = rows[i];
    const score = Number(r[5]);
    if (score !== prev) { rank = i + 1; prev = score; }
    top.push({ rank: rank, nickname: String(r[3]), score: score, grade: String(r[6]), gift: String(r[4]), gameId: String(r[2]) });
  }
  const board = { total: rows.length, top: top, scores: rows.map(function (r) { return Number(r[5]); }) };
  try { cache.put('board:' + key, JSON.stringify(board), CONFIG.BOARD_CACHE_S); } catch (err) { /* 100KB 초과 시 캐시 생략 */ }
  return board;
}

function invalidateBoards_(day) {
  CacheService.getScriptCache().removeAll(['board:ALL', 'board:' + day]);
}

function updateBest_(period, clientId, gameId, session, r, now) {
  const sh = sheet_('best');
  const rows = readRows_('best', BEST_HEADERS.length);
  const row = [txt_(period), txt_(clientId), txt_(gameId), txt_(session.nickname), session.gift, r.score, r.grade, new Date(now)];
  for (let i = 0; i < rows.length; i++) {
    if (periodOf_(rows[i][0]) === period && String(rows[i][1]) === clientId) {
      if (r.score > Number(rows[i][5])) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

// ---------------- 점수 계산 (ScoreCalculator.java / js/scoring.js 와 동일) ----------------

function calculate_(raw) {
  const kept = [];
  let prev = -1, last = -1e9;
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t < 0 || t > CONFIG.DURATION_MS || t < prev) throw apiError_('INVALID_TAPS', '탭 기록이 올바르지 않아요.', 422);
    prev = t;
    if (t - last >= CONFIG.MIN_INTERVAL_MS) { kept.push(t); last = t; }
  }
  const n = kept.length;
  if (n > CONFIG.MAX_TAPS) throw apiError_('INVALID_TAPS', '사람의 손으로는 불가능한 속도예요! 다시 도전해 주세요.', 422);

  let peak = 0;
  for (let i = 0, j = 0; i < n; i++) {
    while (kept[i] - kept[j] >= CONFIG.PEAK_WINDOW_MS) j++;
    peak = Math.max(peak, i - j + 1);
  }
  let maxCombo = 0, combo = 0;
  for (let i = 0; i < n; i++) {
    combo = i > 0 && kept[i] - kept[i - 1] <= CONFIG.COMBO_WINDOW_MS ? combo + 1 : 1;
    maxCombo = Math.max(maxCombo, combo);
  }
  let steadiness = 0;
  if (n >= 5) {
    let sum = 0;
    for (let i = 1; i < n; i++) sum += kept[i] - kept[i - 1];
    const mean = sum / (n - 1);
    let v = 0;
    for (let i = 1; i < n; i++) { const d = kept[i] - kept[i - 1] - mean; v += d * d; }
    const cv = mean > 0 ? Math.sqrt(v / (n - 1)) / mean : 1;
    steadiness = Math.round(Math.max(0, Math.min(1, 1 - cv)) * 100);
  }
  const completionMs = n >= CONFIG.TARGET_TAPS ? kept[CONFIG.TARGET_TAPS - 1] : null;
  let score = n * 100 + peak * 150 + maxCombo * 30 + steadiness * 10;
  if (completionMs !== null) score += 2000 + Math.floor((CONFIG.DURATION_MS - completionMs) / 2);
  return {
    score: score, tapCount: n, avgTps: Math.round((n * 10000) / CONFIG.DURATION_MS) / 10, peakTps: peak,
    maxCombo: maxCombo, steadiness: steadiness, completionMs: completionMs, grade: gradeOf_(score),
  };
}

function gradeOf_(score) {
  if (score >= 22000) return 'S';
  if (score >= 16000) return 'A';
  if (score >= 11000) return 'B';
  return 'C';
}

// ---------------- 검증 ----------------

function sanitizeNickname_(input) {
  if (typeof input !== 'string' || input.length > 40 || /[\u0000-\u001f\u007f]/.test(input)) throw badNick_();
  const nick = input.normalize('NFC').trim().replace(/ {2,}/g, ' ');
  if (!NICK_RE.test(nick)) throw badNick_();
  const compact = nick.toLowerCase().replace(/[ _]/g, '');
  const banned = bannedWords_();
  for (let i = 0; i < banned.length; i++) {
    if (banned[i] && compact.indexOf(banned[i]) >= 0) throw apiError_('NICKNAME_NOT_ALLOWED', '사용할 수 없는 닉네임이에요.', 400);
  }
  return nick;
}

function badNick_() { return apiError_('INVALID_NICKNAME', '닉네임은 한글/영문/숫자 2~12자로 입력해 주세요.', 400); }

/** 금칙어: 기본 목록 + 스크립트 속성 BANNED_WORDS (쉼표 구분) */
function bannedWords_() {
  const extra = PropertiesService.getScriptProperties().getProperty('BANNED_WORDS') || '';
  return DEFAULT_BANNED.concat(extra.split(',')).map(function (w) { return w.trim().toLowerCase().replace(/ /g, ''); });
}

function requireUuid_(v) {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw invalid_();
  return v.toLowerCase();
}

// ---------------- 시트 유틸 ----------------

// 이 스크립트가 붙어 있는 스프레드시트만 사용 (최소 권한: spreadsheets.currentonly)
function spreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 시트가 문자열을 날짜/숫자/수식으로 자동 변환하지 않도록 텍스트로 고정한다.
 * (예: 닉네임 "1e5" → 숫자, 기간 "2026-12-24" → 날짜, "=..." → 수식 주입 방지)
 */
function txt_(s) {
  return "'" + String(s);
}

/** 기간/일자 셀 값을 'ALL' 또는 'yyyy-MM-dd' 문자열로 정규화 */
function periodOf_(v) {
  return v instanceof Date ? Utilities.formatDate(v, CONFIG.TIME_ZONE, 'yyyy-MM-dd') : String(v);
}

function sheet_(name) {
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('시트 없음: ' + name + ' (setup() 을 먼저 실행하세요)');
  return sh;
}

function readRows_(name, cols) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, cols).getValues();
}

function findRecord_(gameId) {
  const sh = sheet_('records');
  const cell = sh.getRange('A:A').createTextFinder(gameId).matchEntireCell(true).findNext();
  if (!cell || cell.getRow() < 2) return null;
  const v = sh.getRange(cell.getRow(), 1, 1, RECORD_HEADERS.length).getValues()[0];
  return {
    gameId: String(v[0]), nickname: String(v[2]), gift: String(v[3]), score: Number(v[4]), grade: String(v[5]),
    tapCount: Number(v[6]), peakTps: Number(v[8]), day: periodOf_(v[14]),
  };
}

function dayKey_(ms) {
  return Utilities.formatDate(new Date(ms), CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function toTime_(v) {
  return v instanceof Date ? v.getTime() : new Date(v).getTime() || 0;
}

/** 최초 1회 실행: 시트와 머리글을 만들고 이 스프레드시트를 저장소로 지정 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const make = function (name, headers) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1f2a8a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  };
  make('records', RECORD_HEADERS);
  make('best', BEST_HEADERS);
  const first = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 2) ss.deleteSheet(first);
  return 'setup 완료';
}
