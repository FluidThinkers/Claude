// Paesaggio sonoro procedurale: risacca, vento, rintocchi
export class Sound {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

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
    this.windG.gain.setTargetAtTime(0.05 + 0.04 * Math.sin(time * 0.13) + speed * 0.006 + (onWater ? 0.03 : 0), t, 0.5);
    this.windF.frequency.setTargetAtTime(500 + 400 * Math.sin(time * 0.09), t, 0.5);
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

  toggle() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }
}
