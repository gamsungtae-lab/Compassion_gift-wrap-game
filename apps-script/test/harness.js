// Code.gs 를 브라우저에서 구글 서비스 모의 객체로 실행해 검증한다.
// 실제 시트처럼 문자열 자동 변환(날짜/숫자, 앞의 ' 는 텍스트 표시)을 흉내낸다.

const out = [];
let failed = 0;
const log = (ok, name, extra = '') => {
  if (!ok) failed++;
  out.push(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

// ---------- 모의 시계 ----------
const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;
const advance = (ms) => { offset += ms; };

// ---------- 시트 모의 ----------
function parseCell(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00+09:00');
  if (v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  if (v === 'TRUE' || v === 'FALSE') return v === 'TRUE';
  return v;
}

class Range {
  constructor(sheet, row, col, nr, nc) { Object.assign(this, { sheet, row, col, nr, nc }); }
  getValues() {
    const res = [];
    for (let r = 0; r < this.nr; r++) {
      const src = this.sheet.rows[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(src[this.col - 1 + c] ?? '');
      res.push(line);
    }
    return res;
  }
  setValues(vals) {
    vals.forEach((line, r) => {
      const idx = this.row - 1 + r;
      this.sheet.rows[idx] = this.sheet.rows[idx] || [];
      line.forEach((v, c) => { this.sheet.rows[idx][this.col - 1 + c] = parseCell(v); });
    });
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setNumberFormat() { return this; }
  createTextFinder(text) {
    const sheet = this.sheet;
    return {
      matchEntireCell() { return this; },
      findNext() {
        const i = sheet.rows.findIndex((r) => String(r[0]) === text);
        return i < 0 ? null : { getRow: () => i + 1 };
      },
    };
  }
}

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return new Range(this, 1, 1, this.rows.length, 1);
    return new Range(this, a, b, c ?? 1, d ?? 1);
  }
  appendRow(arr) { this.rows.push(arr.map(parseCell)); }
  setFrozenRows() {}
}

const sheets = new Map();
const ss = {
  getSheetByName: (n) => sheets.get(n) || null,
  insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); return s; },
  getSheets: () => [...sheets.values()],
  deleteSheet: (s) => sheets.delete(s.name),
  getId: () => 'mock',
};

// ---------- 구글 서비스 모의 ----------
const cacheStore = new Map();
Object.assign(window, {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
      put: (k, v) => { if (typeof v !== 'string') throw new Error('cache value must be string'); cacheStore.set(k, v); },
      remove: (k) => cacheStore.delete(k),
      removeAll: (ks) => ks.forEach((k) => cacheStore.delete(k)),
    }),
  },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d),
  },
});

// ---------- Code.gs 로드 ----------
const code = await (await fetch('../Code.gs', { cache: 'no-store' })).text();
(0, eval)(code);

const post = (body) => JSON.parse(window.doPost({ postData: { contents: JSON.stringify(body) } }).content);
const get = (params) => JSON.parse(window.doGet({ parameter: params }).content);
const uuid = () => crypto.randomUUID();

try {
  log(window.setup() === 'setup 완료', 'setup() 이 시트를 만든다', [...sheets.keys()].join(','));

  // 입력 검증
  const A = uuid();
  for (const [nick, code] of [['<img src=x>', 'INVALID_NICKNAME'], ['a', 'INVALID_NICKNAME'], ['a\nb', 'INVALID_NICKNAME'],
    ['관 리 자', 'NICKNAME_NOT_ALLOWED'], ['=HYPERLINK(1)', 'INVALID_NICKNAME']]) {
    const r = post({ action: 'start', nickname: nick, clientId: A, gift: 'BEAR' });
    log(!r.ok && r.error === code, `닉네임 거부: ${JSON.stringify(nick)}`, r.error);
  }
  log(post({ action: 'start', nickname: '요정', clientId: 'not-uuid', gift: 'BEAR' }).error === 'INVALID_INPUT', 'clientId 형식 검증');
  log(post({ action: 'start', nickname: '요정', clientId: A, gift: 'CAR' }).error === 'INVALID_INPUT', '선물 종류 검증');
  log(window.doPost({ postData: { contents: 'x'.repeat(30000) } }).content.includes('INVALID_INPUT'), '과도한 요청 본문 거부');
  log(get({ action: 'leaderboard', period: "all' OR 1=1" }).error === 'INVALID_INPUT', '순위표 period 검증');
  log(get({ action: 'leaderboard', limit: '1000' }).error === 'INVALID_INPUT', '순위표 limit 검증');

  // 너무 이른 제출
  let s = post({ action: 'start', nickname: '급한요정', clientId: A, gift: 'BEAR' });
  let r = post({ action: 'finish', gameId: s.data.gameId, clientId: A, taps: [0, 50] });
  log(!r.ok && r.error === 'INVALID_TIMING', '10초 전 제출 거부', r.error);

  // 정상 플레이 (초당 10회, 100탭)
  s = post({ action: 'start', nickname: '산타요정', clientId: A, gift: 'SOCCER' });
  log(s.ok && s.data.durationMs === 10000 && s.data.targetTaps === 60, '게임 시작');
  advance(10500);
  const taps = Array.from({ length: 100 }, (_, i) => i * 100);
  r = post({ action: 'finish', gameId: s.data.gameId, clientId: A, taps });
  const { calculate } = await import('/src/main/resources/static/js/scoring.js');
  const expected = calculate(taps).score;
  log(r.ok && r.data.result.score === expected, '서버 점수 = 프론트 공식', `${r.data?.result?.score} vs ${expected}`);
  log(r.ok && r.data.allRank.rank === 1 && r.data.allRank.total === 1, '첫 기록 1위 / 1명');
  const firstGame = s.data.gameId;

  // 중복 제출, 타인 제출
  r = post({ action: 'finish', gameId: firstGame, clientId: A, taps: [0] });
  log(r.error === 'ALREADY_FINISHED', '같은 게임 재제출 거부', r.error);
  s = post({ action: 'start', nickname: '주인', clientId: A, gift: 'BOOK' });
  advance(10500);
  r = post({ action: 'finish', gameId: s.data.gameId, clientId: uuid(), taps: [0] });
  log(r.error === 'GAME_NOT_FOUND', '다른 사람의 게임 제출 거부', r.error);

  // 매크로
  const B = uuid();
  s = post({ action: 'start', nickname: '매크로', clientId: B, gift: 'BOOK' });
  advance(10500);
  r = post({ action: 'finish', gameId: s.data.gameId, clientId: B, taps: Array.from({ length: 300 }, (_, i) => i * 30) });
  log(r.error === 'INVALID_TAPS', '초당 33회 매크로 거부', r.error);

  // 두 번째 플레이어가 더 높은 점수 → 순위 변동
  const C = uuid();
  s = post({ action: 'start', nickname: '1e5', clientId: C, gift: 'BEAR' });
  advance(10500);
  r = post({ action: 'finish', gameId: s.data.gameId, clientId: C, taps: Array.from({ length: 125 }, (_, i) => i * 80) });
  log(r.ok && r.data.allRank.rank === 1 && r.data.allRank.total === 2, '더 높은 점수가 1위', JSON.stringify(r.data?.allRank));
  const rk = get({ action: 'rank', gameId: firstGame });
  log(rk.ok && rk.data.allRank.rank === 2 && rk.data.todayRank.rank === 2, '기존 플레이어는 2위로 갱신', JSON.stringify(rk.data));

  const lb = get({ action: 'leaderboard', period: 'today', limit: '20' });
  log(lb.ok && lb.data.entries.length === 2 && lb.data.entries[0].nickname === '1e5', '오늘 순위표 (숫자처럼 보이는 닉네임도 문자 유지)',
    JSON.stringify(lb.data.entries.map((e) => e.nickname)));
  const all = get({ action: 'leaderboard', period: 'all' });
  log(all.ok && all.data.total === 2, '전체 순위표 인원');

  // 같은 플레이어의 낮은 점수는 최고 기록을 덮지 않음
  s = post({ action: 'start', nickname: '1e5', clientId: C, gift: 'BEAR' });
  advance(10500);
  post({ action: 'finish', gameId: s.data.gameId, clientId: C, taps: [0, 500, 1000] });
  const lb2 = get({ action: 'leaderboard', period: 'all' });
  log(lb2.data.total === 2 && lb2.data.entries[0].score === r.data.result.score, '최고 기록 유지 (플레이어당 1줄)');

  const sh = get({ action: 'share', gameId: firstGame });
  log(sh.ok && sh.data.nickname === '산타요정' && sh.data.allRank.rank === 2, '공유(도전장) 정보');
  log(get({ action: 'share', gameId: uuid() }).error === 'GAME_NOT_FOUND', '없는 기록 공유 요청');
  log(get({ action: 'nope' }).error === 'NOT_FOUND', '알 수 없는 action');

  // ---------- 프론트엔드 SheetsApi ↔ Code.gs 연동 ----------
  const { SheetsApi, isSheetsUrl } = await import('/src/main/resources/static/js/api.js');
  const URL_ = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
  log(isSheetsUrl(URL_) && !isSheetsUrl('https://evil.example.com/exec'), 'SHEETS_URL 형식 검증');
  const realFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    if (u.origin + u.pathname !== URL_) return realFetch(input, init);
    const ct = init.headers?.['Content-Type'] ?? '';
    if (init.method === 'POST' && !ct.startsWith('text/plain')) throw new Error('preflight 유발 헤더');
    const res = init.method === 'POST'
      ? window.doPost({ postData: { contents: init.body } })
      : window.doGet({ parameter: Object.fromEntries(u.searchParams) });
    return new Response(res.content, { headers: { 'Content-Type': 'application/json' } });
  };
  const api = new SheetsApi(URL_);
  const g = await api.startGame('연동요정', 'SCARF');
  advance(10500);
  const f = await api.finishGame(g.gameId, Array.from({ length: 70 }, (_, i) => i * 120));
  log(f.result.tapCount === 70 && f.allRank.total === 3, 'SheetsApi 시작/제출', `${f.result.score}점 ${f.allRank.rank}위/${f.allRank.total}`);
  const board = await api.leaderboard('all', 10);
  log(board.entries.some((e) => e.gameId === g.gameId), 'SheetsApi 순위표');
  try {
    await api.finishGame(g.gameId, [0]);
    log(false, 'SheetsApi 오류 전달');
  } catch (e) {
    log(e.code === 'ALREADY_FINISHED' && e.message.length > 0, 'SheetsApi 오류 코드/메시지 전달', e.code);
  }
  // 서버가 바쁠 때(BUSY) 자동 재시도: 처음 두 번은 잠금 획득 실패 → 세 번째에 성공해야 함
  const g2 = await api.startGame('재시도요정', 'BOOK');
  advance(10500);
  let lockFails = 2;
  const realLock = window.LockService;
  window.LockService = { getScriptLock: () => ({ tryLock: () => (lockFails-- > 0 ? false : true), releaseLock: () => {} }) };
  const t0 = performance.now();
  const f2 = await api.finishGame(g2.gameId, Array.from({ length: 40 }, (_, i) => i * 200));
  window.LockService = realLock;
  log(f2.result.tapCount === 40 && lockFails < 0, '서버 혼잡(BUSY) 시 자동 재시도 후 성공', `${Math.round(performance.now() - t0)}ms`);

  // 통신 오류는 결과 제출에서 재시도하지 않음 (중복 처리 방지)
  let calls = 0;
  const okFetch = window.fetch;
  window.fetch = async () => { calls++; throw new TypeError('network down'); };
  try { await api.finishGame(uuid(), [0]); } catch (e) { log(e.code === 'NETWORK' && calls === 1, '결과 제출 통신 오류는 1회만 시도', `calls=${calls}`); }
  window.fetch = okFetch;

  window.fetch = realFetch;
} catch (e) {
  log(false, '예외 발생', e.stack || String(e));
}

out.unshift(failed === 0 ? `전체 통과 (${out.length}개)` : `실패 ${failed}개 / ${out.length}개`);
document.getElementById('out').textContent = out.join('\n');
window.__result = { failed, total: out.length - 1, lines: out };
