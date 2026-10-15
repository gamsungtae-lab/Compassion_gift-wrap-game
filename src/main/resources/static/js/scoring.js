// 서버 ScoreCalculator.java 와 동일한 공식 (화면 미리보기/오프라인 모드용, 최종 점수는 서버가 계산)
export const RULES = {
  durationMs: 10000,
  targetTaps: 60,
  maxTaps: 250,
  minIntervalMs: 20,
  comboWindowMs: 250,
  peakWindowMs: 1000,
};

export const GRADES = {
  S: { title: '산타 마스터', desc: '산타 할아버지도 놀랄 손놀림!', color: '#ffd76a' },
  A: { title: '루돌프 에이스', desc: '썰매보다 빠른 포장 실력!', color: '#ff8a8a' },
  B: { title: '꼬마 요정', desc: '정성 가득, 따뜻한 포장이에요', color: '#8fd3a8' },
  C: { title: '견습 요정', desc: '마음만은 이미 일등이에요', color: '#9cc4ff' },
};

export function gradeOf(score) {
  if (score >= 22000) return 'S';
  if (score >= 16000) return 'A';
  if (score >= 11000) return 'B';
  return 'C';
}

export function normalize(raw, rules = RULES) {
  const kept = [];
  let prev = -1, last = -1e9;
  for (const t of raw) {
    if (!Number.isInteger(t) || t < 0 || t > rules.durationMs || t < prev) throw new Error('INVALID_TAPS');
    prev = t;
    if (t - last >= rules.minIntervalMs) { kept.push(t); last = t; }
  }
  return kept;
}

export function calculate(raw, rules = RULES) {
  const taps = normalize(raw, rules);
  const n = taps.length;
  if (n > rules.maxTaps) throw new Error('INVALID_TAPS');

  let peak = 0;
  for (let i = 0, j = 0; i < n; i++) {
    while (taps[i] - taps[j] >= rules.peakWindowMs) j++;
    peak = Math.max(peak, i - j + 1);
  }
  let maxCombo = 0, combo = 0;
  for (let i = 0; i < n; i++) {
    combo = i > 0 && taps[i] - taps[i - 1] <= rules.comboWindowMs ? combo + 1 : 1;
    maxCombo = Math.max(maxCombo, combo);
  }
  let steadiness = 0;
  if (n >= 5) {
    let sum = 0;
    for (let i = 1; i < n; i++) sum += taps[i] - taps[i - 1];
    const mean = sum / (n - 1);
    let v = 0;
    for (let i = 1; i < n; i++) { const d = taps[i] - taps[i - 1] - mean; v += d * d; }
    const cv = mean > 0 ? Math.sqrt(v / (n - 1)) / mean : 1;
    steadiness = Math.round(Math.max(0, Math.min(1, 1 - cv)) * 100);
  }
  const completionMs = n >= rules.targetTaps ? taps[rules.targetTaps - 1] : null;
  let score = n * 100 + peak * 150 + maxCombo * 30 + steadiness * 10;
  if (completionMs !== null) score += 2000 + Math.floor((rules.durationMs - completionMs) / 2);
  const avgTps = Math.round((n * 10000) / rules.durationMs) / 10;
  return { score, tapCount: n, avgTps, peakTps: peak, maxCombo, steadiness, completionMs, grade: gradeOf(score) };
}

/** 플레이 중 실시간 표시용 */
export class LiveTracker {
  constructor(rules = RULES) {
    this.rules = rules;
    this.taps = [];      // 원본 기록 (서버 전송)
    this.kept = [];      // 정규화된 탭
    this.combo = 0;
  }

  add(t) {
    const last = this.taps.length ? this.taps[this.taps.length - 1] : -1;
    if (t < last) t = last;
    this.taps.push(t);
    const lk = this.kept.length ? this.kept[this.kept.length - 1] : -1e9;
    if (t - lk < this.rules.minIntervalMs) return false;
    this.combo = this.kept.length && t - lk <= this.rules.comboWindowMs ? this.combo + 1 : 1;
    this.kept.push(t);
    return true;
  }

  count() { return this.kept.length; }

  tpsAt(now) {
    let c = 0;
    for (let i = this.kept.length - 1; i >= 0 && now - this.kept[i] < 1000; i--) c++;
    return c;
  }

  comboAt(now) {
    const lk = this.kept[this.kept.length - 1];
    return lk !== undefined && now - lk <= this.rules.comboWindowMs ? this.combo : 0;
  }
}
