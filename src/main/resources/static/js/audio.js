// Web Audio 로 합성한 효과음과 오르골 캐럴(Jingle Bells, 퍼블릭 도메인) — 외부 음원 파일 없음
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5, 1568.0, 1760.0];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this._musicTimer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  _bell(freq, when, dur = 0.5, vol = 0.25, out = this.master) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(out);
    for (const [mul, v] of [[1, 1], [2, 0.35], [3.01, 0.12]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mul;
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  _noise(when, dur, freq, q, vol) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(when, Math.random() * 0.3);
    src.stop(when + dur);
  }

  tap(combo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const f = PENTA[Math.min(PENTA.length - 1, Math.floor(combo / 6) % PENTA.length)];
    this._bell(f, t, 0.22, 0.12);
    this._noise(t, 0.05, 3200, 1.2, 0.08);
  }

  crinkle() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this._noise(t + i * 0.035, 0.08, 2000 + Math.random() * 3000, 0.8, 0.18);
  }

  pop() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  beep(final = false) {
    if (!this.ctx || this.muted) return;
    this._bell(final ? 1046.5 : 659.25, this.ctx.currentTime, final ? 0.6 : 0.3, 0.25);
  }

  fanfare() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this._bell(f, t + i * 0.08, 0.9, 0.2));
    for (let i = 0; i < 14; i++) this._bell(2093 + Math.random() * 1500, t + 0.5 + i * 0.05, 0.4, 0.05);
  }

  timeUp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [783.99, 659.25, 523.25].forEach((f, i) => this._bell(f, t + i * 0.12, 0.5, 0.2));
  }

  // ---- 오르골 캐럴 ----
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, C3: 130.81, F3: 174.61, G3: 196.0, D3: 146.83 };
    const mel = [
      ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
      ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
      ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1], ['D5', 2], ['G5', 2],
      ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
      ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
      ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1], ['C5', 4],
    ];
    const bass = ['C3', 'C3', 'C3', 'C3', 'F3', 'C3', 'D3', 'G3', 'C3', 'C3', 'C3', 'C3', 'F3', 'C3', 'G3', 'C3'];
    const beat = 0.42;
    const total = mel.reduce((s, [, d]) => s + d, 0);
    const playOnce = () => {
      if (!this.musicOn) return;
      let t = this.ctx.currentTime + 0.1;
      const start = t;
      for (const [n, d] of mel) { this._bell(N[n], t, Math.min(1.2, d * beat * 1.6), 0.18, this.musicBus); t += d * beat; }
      bass.forEach((n, i) => this._bell(N[n], start + i * 4 * beat, 1.4, 0.16, this.musicBus));
      this._musicTimer = setTimeout(playOnce, (total * beat + 1.2) * 1000);
    };
    playOnce();
  }

  stopMusic() {
    this.musicOn = false;
    clearTimeout(this._musicTimer);
    if (this.musicBus) {
      const g = this.musicBus.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.4);
      // 이미 예약된 음은 버스에서 잘라내고, 다음 재생 때 볼륨 복원
      const old = this.musicBus;
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);
      setTimeout(() => old.disconnect(), 600);
    }
  }
}
