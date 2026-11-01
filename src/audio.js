// Paesaggio sonoro procedurale: risacca, vento, rintocchi
export class Sound {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    // filtro generale: sott'acqua tutto diventa ovattato
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
    this.master.connect(this.muffle); this.muffle.connect(ctx.destination);

    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 4); return s; };

    this.waveF = ctx.createBiquadFilter(); this.waveF.type = 'lowpass'; this.waveF.frequency.value = 600;
    this.waveG = ctx.createGain(); this.waveG.gain.value = 0;
    noise().connect(this.waveF); this.waveF.connect(this.waveG); this.waveG.connect(this.master);

    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 700; this.windF.Q.value = 0.6;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    noise().connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master);

    this.drone = ctx.createOscillator(); this.drone.frequency.value = 55;
    this.droneG = ctx.createGain(); this.droneG.gain.value = 0;
    this.drone.connect(this.droneG); this.droneG.connect(this.master); this.drone.start();

    // eco semplice per i rintocchi
    this.fx = ctx.createGain();
    const dl = ctx.createDelay(2); dl.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
    this.fx.connect(this.master); this.fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.master);
  }

  update(time, shoreDist, onWater, speed, night) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const swell = 0.5 + 0.5 * Math.sin(time * 0.7) * Math.sin(time * 0.23 + 1);
    const near = Math.exp(-Math.abs(shoreDist) / 25);
    this.waveG.gain.setTargetAtTime((0.05 + 0.3 * near) * (0.4 + 0.6 * swell), t, 0.3);
    this.waveF.frequency.setTargetAtTime(300 + 900 * swell * near, t, 0.3);
    this.windG.gain.setTargetAtTime((0.04 + 0.11 * (this.windBoost || 0)) + speed * 0.004 + (onWater ? 0.02 : 0), t, 0.4);
    this.windF.frequency.setTargetAtTime(450 + 500 * (this.windBoost || 0) + 150 * Math.sin(time * 0.9), t, 0.3);
    this.droneG.gain.setTargetAtTime(0.025 * night, t, 1.0);
  }

  chime(i) {
    if (!this.ctx) return;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const f = 392 * Math.pow(2, scale[i % scale.length] / 12);
    this._bell(f, 0.22);
  }

  chord() {
    if (!this.ctx) return;
    [196, 293.66, 392, 587.33].forEach((f, k) => setTimeout(() => this._bell(f, 0.14), k * 90));
  }

  _bell(f, vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [m, a] of [[1, 1], [2.01, 0.35], [3.02, 0.15], [4.17, 0.08]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 / m);
      o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + 4);
    }
  }

  step(kind, speed) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = 0.18;
    if (!this.stepBuf) {
      this.stepBuf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = this.stepBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const src = ctx.createBufferSource(); src.buffer = this.stepBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'water' ? 'bandpass' : 'lowpass';
    f.frequency.value = kind === 'water' ? 900 + Math.random() * 500 : 1400 + Math.random() * 600;
    f.Q.value = kind === 'water' ? 1.5 : 0.7;
    const g = ctx.createGain();
    const v = (kind === 'water' ? 0.09 : 0.06) * Math.min(1, speed / 4);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  setUnder(k) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(k > 0.5 ? 380 : 20000, t, 0.08);
    if (!this.underG) {
      // rombo sordo del mare quando sei sotto
      this.underG = this.ctx.createGain(); this.underG.gain.value = 0;
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 42;
      const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuf(); n.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
      n.connect(f); f.connect(this.underG); o.connect(this.underG); this.underG.connect(this.ctx.destination);
      o.start(); n.start();
    }
    this.underG.gain.setTargetAtTime(k > 0.5 ? 0.18 : 0, t, 0.15);
  }

  _noiseBuf() {
    if (this._nb) return this._nb;
    const ctx = this.ctx, len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return (this._nb = b);
  }

  // un'onda d'acqua breve: bracciata, pagaiata, tuffo
  splash(kind = 'stroke', vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(kind === 'dive' ? 500 : 1100 + Math.random() * 500, t);
    f.frequency.exponentialRampToValueAtTime(kind === 'paddle' ? 500 : 300, t + 0.4);
    f.Q.value = 0.9;
    const g = ctx.createGain();
    const len = kind === 'dive' ? 1.0 : 0.45;
    const v = (kind === 'dive' ? 0.35 : kind === 'paddle' ? 0.16 : 0.12) * vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 2); src.stop(t + len + 0.05);
  }

  bubbles() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * (0.04 + Math.random() * 0.07);
      const o = ctx.createOscillator(); o.type = 'sine';
      const f0 = 300 + Math.random() * 500;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.1);
    }
  }

  // verso di gabbiano: due o tre "kia" che scendono
  gull(pan = 0, dist = 30) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const vol = Math.min(0.12, 2.2 / (dist + 8));
    if (vol < 0.01) return;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    const n = 2 + (Math.random() * 3 | 0);
    const base = 1250 + Math.random() * 350;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * (0.22 + Math.random() * 0.08);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.12, t);
      o.frequency.linearRampToValueAtTime(base, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.62, t + 0.24);
      const vib = ctx.createOscillator(); vib.frequency.value = 28; const vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 2.2;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(f); f.connect(f2); f2.connect(g); g.connect(p);
      o.start(t); vib.start(t); o.stop(t + 0.3); vib.stop(t + 0.3);
    }
  }

  // motore a scoppio: due dente di sega leggermente stonati, filtrati
  engine(on, speed, throttle) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.eng && on) {
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const am = ctx.createOscillator(); am.type = 'square'; const amg = ctx.createGain(); amg.gain.value = 0.35;
      am.connect(amg); amg.connect(g.gain);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start(); am.start();
      this.eng = { g, f, o1, o2, am };
    }
    if (!this.eng) return;
    const rpm = 0.25 + Math.min(Math.abs(speed) / 26, 1) * 0.75 + throttle * 0.12;
    this.eng.o1.frequency.setTargetAtTime(38 + rpm * 95, t, 0.08);
    this.eng.o2.frequency.setTargetAtTime(38.6 + rpm * 95, t, 0.08);
    this.eng.am.frequency.setTargetAtTime(19 + rpm * 47, t, 0.08);
    this.eng.f.frequency.setTargetAtTime(350 + rpm * 1400 + throttle * 300, t, 0.08);
    this.eng.g.gain.setTargetAtTime(on ? 0.05 + throttle * 0.04 : 0, t, on ? 0.2 : 0.6);
  }

  // il vento: segue le raffiche
  wind(k) {
    if (!this.ctx) return;
    this.windBoost = k;
  }

  toggle() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }
}
