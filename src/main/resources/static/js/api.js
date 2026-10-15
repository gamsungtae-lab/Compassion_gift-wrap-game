// 서버 API 클라이언트. 서버가 없으면(정적 미리보기) 브라우저 로컬 저장소로 동작하는 오프라인 모드로 전환.
import { calculate, RULES } from './scoring.js';
import { SHEETS_URL } from './config.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* 사생활 보호 모드 등 */ }
  return null;
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function clientId() {
  let id = store('gw.clientId');
  if (!isUuid(id)) { id = uuid(); store('gw.clientId', id); }
  return id;
}

export class ApiError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

class ServerApi {
  constructor() { this.csrf = null; this.offline = false; }

  async init() {
    const res = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('application/json')) throw new Error('no server');
    this.csrf = await res.json();
  }

  async request(method, url, body, retry = true) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && this.csrf) headers[this.csrf.headerName] = this.csrf.token;
    const res = await fetch(url, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 403 && retry && method !== 'GET') {
      await this.init();
      return this.request(method, url, body, false);
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      throw new ApiError(data?.error ?? 'HTTP_' + res.status, data?.message ?? '서버와 통신하지 못했어요.', res.status);
    }
    return data;
  }

  startGame(nickname, gift) {
    return this.request('POST', '/api/games', { nickname, clientId: clientId(), gift });
  }

  finishGame(gameId, taps) {
    return this.request('POST', `/api/games/${encodeURIComponent(gameId)}/finish`, { clientId: clientId(), taps });
  }

  leaderboard(period = 'all', limit = 20) {
    const q = new URLSearchParams({ period, limit: String(limit) });
    return this.request('GET', `/api/leaderboard?${q}`);
  }

  rank(gameId) { return this.request('GET', `/api/games/${encodeURIComponent(gameId)}/rank`); }

  share(gameId) { return this.request('GET', `/api/games/${encodeURIComponent(gameId)}/share`); }
}

// ---- 구글 스프레드시트(Apps Script 웹 앱) 모드 ----
const SHEETS_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
export const isSheetsUrl = (u) => typeof u === 'string' && SHEETS_URL_RE.test(u);

export class SheetsApi {
  constructor(url) {
    this.url = url;
    this.offline = false;
    this.pollMs = 20000; // Apps Script 할당량을 고려해 순위 갱신 간격을 늘림
  }

  async init() {}

  async call(method, payload) {
    let res;
    try {
      if (method === 'GET') {
        res = await fetch(`${this.url}?${new URLSearchParams(payload)}`, {
          method: 'GET', redirect: 'follow', credentials: 'omit', cache: 'no-store',
        });
      } else {
        // text/plain 으로 보내 CORS 사전요청(preflight) 없이 전송 (Apps Script 는 OPTIONS 미지원)
        res = await fetch(this.url, {
          method: 'POST', redirect: 'follow', credentials: 'omit',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      throw new ApiError('NETWORK', '서버와 통신하지 못했어요. 잠시 후 다시 시도해 주세요.', 0);
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!data || typeof data !== 'object') throw new ApiError('NETWORK', '서버와 통신하지 못했어요.', res.status);
    if (!data.ok) throw new ApiError(data.error ?? 'ERROR', data.message ?? '요청을 처리하지 못했어요.', data.status ?? 0);
    return data.data;
  }

  startGame(nickname, gift) {
    return this.call('POST', { action: 'start', nickname, clientId: clientId(), gift });
  }

  finishGame(gameId, taps) {
    return this.call('POST', { action: 'finish', gameId, clientId: clientId(), taps });
  }

  leaderboard(period = 'all', limit = 20) {
    return this.call('GET', { action: 'leaderboard', period, limit: String(limit) });
  }

  rank(gameId) { return this.call('GET', { action: 'rank', gameId }); }

  share(gameId) { return this.call('GET', { action: 'share', gameId }); }
}

// ---- 오프라인(로컬) 모드: 서버 없이 화면 미리보기 ----
const SAMPLE = [
  ['눈꽃요정', 'SOCCER', 24310], ['루돌프킹', 'BEAR', 21980], ['포근한곰', 'SCARF', 19420],
  ['산타손', 'BOOK', 17750], ['별빛소녀', 'SNOWGLOBE', 15680], ['크레파스', 'CRAYON', 13990],
  ['따뜻한마음', 'BEAR', 12450], ['선물배달부', 'BOOK', 10820], ['겨울바람', 'SCARF', 9310], ['반짝이', 'CRAYON', 7600],
];

class LocalApi {
  constructor() { this.offline = true; this.pending = new Map(); }
  async init() {}

  _rows() {
    let rows = [];
    try { rows = JSON.parse(store('gw.local.rows') || '[]'); } catch { rows = []; }
    if (!Array.isArray(rows) || rows.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      rows = SAMPLE.map(([nickname, gift, score], i) => ({
        gameId: uuid(), clientId: `sample-${i}`, nickname, gift, score,
        grade: score >= 22000 ? 'S' : score >= 16000 ? 'A' : score >= 11000 ? 'B' : 'C', day: today, at: Date.now() - i * 60000,
      }));
      store('gw.local.rows', JSON.stringify(rows));
    }
    return rows;
  }

  _board(period) {
    const today = new Date().toISOString().slice(0, 10);
    const best = new Map();
    for (const r of this._rows()) {
      if (period === 'today' && r.day !== today) continue;
      const b = best.get(r.clientId);
      if (!b || r.score > b.score) best.set(r.clientId, r);
    }
    return [...best.values()].sort((a, b) => b.score - a.score || a.at - b.at);
  }

  _rank(period, score) {
    const board = this._board(period);
    return { rank: board.filter((r) => r.score > score).length + 1, total: board.length };
  }

  async startGame(nickname, gift) {
    const gameId = uuid();
    this.pending.set(gameId, { nickname, gift, startedAt: Date.now() });
    return { gameId, durationMs: RULES.durationMs, targetTaps: RULES.targetTaps };
  }

  async finishGame(gameId, taps) {
    const g = this.pending.get(gameId);
    if (!g) throw new ApiError('GAME_NOT_FOUND', '게임 기록을 찾을 수 없어요.', 404);
    this.pending.delete(gameId);
    const result = calculate(taps);
    const rows = this._rows();
    rows.push({ gameId, clientId: clientId(), nickname: g.nickname, gift: g.gift, score: result.score, grade: result.grade, day: new Date().toISOString().slice(0, 10), at: Date.now() });
    store('gw.local.rows', JSON.stringify(rows.slice(-300)));
    return { gameId, nickname: g.nickname, gift: g.gift, result, allRank: this._rank('all', result.score), todayRank: this._rank('today', result.score) };
  }

  async leaderboard(period = 'all', limit = 20) {
    const board = this._board(period);
    let rank = 0, prev = null;
    const entries = board.slice(0, limit).map((r, i) => {
      if (r.score !== prev) { rank = i + 1; prev = r.score; }
      return { rank, nickname: r.nickname, score: r.score, grade: r.grade, gift: r.gift, gameId: r.gameId };
    });
    return { period, total: board.length, entries, updatedAt: new Date().toISOString() };
  }

  async rank(gameId) {
    const r = this._rows().find((x) => x.gameId === gameId);
    if (!r) throw new ApiError('GAME_NOT_FOUND', '', 404);
    return { allRank: this._rank('all', r.score), todayRank: this._rank('today', r.score) };
  }

  async share(gameId) {
    const r = this._rows().find((x) => x.gameId === gameId);
    if (!r) throw new ApiError('GAME_NOT_FOUND', '', 404);
    return { nickname: r.nickname, gift: r.gift, score: r.score, grade: r.grade, allRank: this._rank('all', r.score) };
  }
}

export async function createApi() {
  if (SHEETS_URL) {
    if (isSheetsUrl(SHEETS_URL)) return new SheetsApi(SHEETS_URL);
    console.warn('config.js 의 SHEETS_URL 형식이 올바르지 않아 무시합니다.');
  }
  const server = new ServerApi();
  try {
    await server.init();
    return server;
  } catch {
    return new LocalApi();
  }
}

export const prefs = {
  get nickname() { return store('gw.nickname') || ''; },
  set nickname(v) { store('gw.nickname', v); },
  get best() { return Number(store('gw.best') || 0); },
  set best(v) { store('gw.best', String(v)); },
  get muted() { return store('gw.muted') === '1'; },
  set muted(v) { store('gw.muted', v ? '1' : '0'); },
};
