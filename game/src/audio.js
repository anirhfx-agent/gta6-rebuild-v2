// Synthesised sound: every effect is built with WebAudio oscillators and
// filtered noise, so the game ships no audio files. Created lazily on the
// first user gesture (browsers block audio before interaction).
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._sirenTimer = 0;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.15, filterFreq = 1200) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  click() { this._tone(660, 0.06, 'square', 0.06); }
  pickup() { this._tone(520, 0.09, 'sine', 0.12, 940); }
  cash() { this._tone(880, 0.1, 'triangle', 0.12); this._tone(1320, 0.14, 'triangle', 0.08); }
  punch() { this._noise(0.09, 0.2, 700); }
  gunshot() { this._noise(0.16, 0.3, 2400); this._tone(180, 0.1, 'square', 0.1, 60); }
  crash() { this._noise(0.28, 0.28, 500); this._tone(90, 0.22, 'sawtooth', 0.12, 45); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.12), i * 110)); }
  busted() { this._tone(392, 0.25, 'sawtooth', 0.12, 196); setTimeout(() => this._tone(311, 0.35, 'sawtooth', 0.12, 155), 220); }
  horn() { this._tone(370, 0.18, 'square', 0.07); }

  // Two-tone police siren, called on a timer by the game loop while wanted.
  siren(dt) {
    if (!this.ctx || !this.enabled) return;
    this._sirenTimer -= dt;
    if (this._sirenTimer <= 0) {
      this._sirenTimer = 0.55;
      this._sirenHigh = !this._sirenHigh;
      this._tone(this._sirenHigh ? 820 : 620, 0.5, 'sine', 0.045);
    }
  }
}
