// Paesaggio sonoro procedurale, costruito per somiglianza al vero:
// risacca sincronizzata con le onde, vento a strati, passi diversi per superficie,
// motori con scoppi e marce, riverbero dei luoghi chiusi.

function noiseBuffer(ctx, sec, kind) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
  }
  return b;
}

function impulse(ctx, sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
  }
  return b;
}

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.windBoost = 0.4; this.lastU = 0; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    setTimeout(() => this.loadSamples(), 500);
    this.buf = { white: noiseBuffer(ctx, 3, 'white'), pink: noiseBuffer(ctx, 5, 'pink'), brown: noiseBuffer(ctx, 5, 'brown') };

    // catena: tutto -> master -> (filtro sott'acqua) -> compressore -> uscita, con mandata al riverbero
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.3;
    this.master.connect(this.muffle); this.muffle.connect(this.comp); this.comp.connect(ctx.destination);
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx, 2.4, 3.2);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.04;
    this.muffle.connect(this.verbSend); this.verbSend.connect(this.verb); this.verb.connect(this.comp);

    const loop = (name, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = this.buf[name]; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 3); return s; };
    const chain = (src, ...nodes) => { let n = src; for (const x of nodes) { n.connect(x); n = x; } return n; };
    const lp = (f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; return b; };
    const bp = (f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
    const hp = (f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = 'highpass'; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.mk = { lp, bp, hp, gain };

    // ---- mare: rombo di fondo lontano + sciabordio vicino, panoramico verso la riva
    this.seaPan = ctx.createStereoPanner(); this.seaPan.connect(this.master);
    this.bedG = gain(); chain(loop('brown', 0.9), lp(380), this.bedG, this.seaPan);
    this.washF = lp(1200); this.washG = gain(); chain(loop('pink'), this.washF, this.washG, this.seaPan);

    // ---- vento: tre strati
    this.windLowG = gain(); chain(loop('brown', 1.1), lp(200), this.windLowG, this.master);
    this.windWhF = bp(900, 5); this.windWhG = gain(); chain(loop('pink'), this.windWhF, this.windWhG, this.master);
    this.windHissF = bp(2600, 0.6); this.windHissG = gain(); chain(loop('white'), hp(1800), this.windHissF, this.windHissG, this.master);
    // foglie che frusciano
    this.leafG = gain(); this.leafF = bp(5200, 0.8); chain(loop('white', 0.9), this.leafF, this.leafG, this.master);
    // aria in faccia quando vai veloce
    this.rushF = bp(700, 0.6); this.rushG = gain(); chain(loop('pink', 1.2), this.rushF, this.rushG, this.master);

    // ---- notte: un respiro basso
    this.drone = ctx.createOscillator(); this.drone.frequency.value = 55;
    this.droneG = gain(); this.drone.connect(this.droneG); this.droneG.connect(this.master); this.drone.start();

    // ---- eco per i rintocchi
    this.fx = gain(1);
    const dl = ctx.createDelay(2); dl.delayTime.value = 0.43;
    const fb = gain(0.45);
    const lpf = lp(2500);
    this.fx.connect(this.master); this.fx.connect(dl); dl.connect(lpf); lpf.connect(fb); fb.connect(dl); lpf.connect(this.master);
  }

  // ---------------------------------------------------------------- aggiornamento continuo
  // s: { time, shoreDist, shorePan, surfU, surfSet, onWater, speed, night, under, reverb, trees, exposure }
  update(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const near = Math.exp(-Math.max(0, Math.abs(s.shoreDist) - 2) / 28);
    const far = 0.35 + 0.65 * Math.exp(-Math.abs(s.shoreDist) / 300);
    this.seaPan.pan.setTargetAtTime(s.shorePan * 0.8 * near, t, 0.2);
    this.bedG.gain.setTargetAtTime(0.16 * far * (0.6 + 0.4 * s.surfSet), t, 0.5);
    // sciabordio continuo: sale col fronte della risacca
    const swashEnv = s.surfU < 0.3 ? Math.sin(s.surfU / 0.3 * Math.PI * 0.5) : Math.max(0, 1 - (s.surfU - 0.3) / 0.5);
    this.washG.gain.setTargetAtTime((0.025 + 0.11 * swashEnv * s.surfSet) * near, t, 0.15);
    this.washF.frequency.setTargetAtTime(700 + 2200 * swashEnv, t, 0.15);

    // eventi: frangente, risalita, ritiro sui ciottoli
    const u = s.surfU;
    if (near > 0.08) {
      if (this.lastU < 0.86 && u >= 0.86) this._crash(0.5 * near * (0.5 + 0.6 * s.surfSet), s.shorePan * near, s.surfSet);
      if (this.lastU > 0.9 && u < 0.1) this._swash(0.22 * near * s.surfSet, s.shorePan * near);
      if (this.lastU < 0.36 && u >= 0.36) this._pebbles(0.16 * near * s.surfSet, s.shorePan * near, 2.4);
    }
    this.lastU = u;

    // vento
    const w = this.windBoost, ex = s.exposure ?? 1;
    this.windLowG.gain.setTargetAtTime((0.05 + 0.2 * w * w) * ex, t, 0.6);
    this.windWhF.frequency.setTargetAtTime(500 + 1300 * w + 200 * Math.sin(s.time * 0.37), t, 0.4);
    this.windWhG.gain.setTargetAtTime(0.012 * Math.pow(w, 3) * ex, t, 0.5);
    this.windHissG.gain.setTargetAtTime((0.008 + 0.03 * w) * ex, t, 0.5);
    this.windHissF.frequency.setTargetAtTime(2200 + 1200 * w, t, 0.5);
    const flutter = 0.5 + 0.5 * Math.sin(s.time * 7.3) * Math.sin(s.time * 3.1 + 1);
    this.leafG.gain.setTargetAtTime((s.trees || 0) * (0.01 + 0.05 * w) * (0.5 + 0.5 * flutter), t, 0.1);
    this.rushG.gain.setTargetAtTime(Math.min(0.12, s.speed * s.speed * 0.00018), t, 0.2);
    this.rushF.frequency.setTargetAtTime(500 + s.speed * 40, t, 0.3);
    this.droneG.gain.setTargetAtTime(0.02 * s.night, t, 1.0);
    this.verbSend.gain.setTargetAtTime(s.reverb ?? 0.04, t, 0.4);
    this._form(s, t);
  }

  // ---------------------------------------------------------------- le forme hanno la loro voce
  _formLayers() {
    const ctx = this.ctx, { lp, bp, hp, gain } = this.mk;
    const loop = (name, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = this.buf[name]; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 3); return s; };
    const L = this.fl = {};
    // acqua che scorre attorno al corpo (pesce, flusso, onda sotto): diretta al compressore, non attutita due volte
    L.flowF = lp(420, 0.9); L.flowG = gain(); loop('pink', 0.7).connect(L.flowF); L.flowF.connect(L.flowG); L.flowG.connect(this.comp);
    // cresta dell'onda: rombo che cresce
    L.crestF = lp(500); L.crestG = gain(); loop('brown', 1.0).connect(L.crestF); L.crestF.connect(L.crestG); L.crestG.connect(this.master);
    L.foamF = bp(2400, 0.5); L.foamG = gain(); loop('white', 0.8).connect(L.foamF); L.foamF.connect(L.foamG); L.foamG.connect(this.master);
    // granelli che scorrono (sabbia)
    L.grainF = bp(5200, 0.7); L.grainG = gain(); loop('white', 1.1).connect(L.grainF); L.grainF.connect(L.grainG); L.grainG.connect(this.master);
    // pioggia: fruscio fitto
    L.rainF = hp(2200); L.rainG = gain(); const rl = lp(9000); loop('white', 1).connect(L.rainF); L.rainF.connect(rl); rl.connect(L.rainG); L.rainG.connect(this.master);
    // fusa del gatto: rumore scuro modulato a 26 Hz
    L.purrG = gain(); const pf = lp(260); const pm = gain(0); loop('brown', 1).connect(pf); pf.connect(pm); pm.connect(L.purrG); L.purrG.connect(this.master);
    const plfo = ctx.createOscillator(); plfo.frequency.value = 26; const pd = gain(0.5); plfo.connect(pd); pd.connect(pm.gain); plfo.start(); L.purrLfo = plfo;
    // luce: un accordo lieve
    L.padG = gain(); const pl = lp(1800); pl.connect(L.padG); L.padG.connect(this.fx);
    for (const f of [220, 277.2, 329.6, 440, 554.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8; const g = gain(0.12); o.connect(g); g.connect(pl); o.start(); }
    // quota: muffle d'alta quota
    L.hiF = lp(20000); this.comp.disconnect(); this.comp.connect(L.hiF); L.hiF.connect(ctx.destination);
  }

  _form(s, t) {
    const dtA = Math.min(0.1, t - (this.lastFT || t)); this.lastFT = t;
    const f = s.form || '', v = s.formSpeed || 0;
    if (!this.fl) { if (!f && !s.cat && !s.raining) return; this._formLayers(); }
    const L = this.fl, set = (g, x, tc = 0.3) => g.gain.setTargetAtTime(x, t, tc);
    // cambio forma: la voce della forma di prima si spegne subito
    const key = f + (s.cat ? '+cat' : '');
    if (key !== this.lastForm) {
      if (this.lastForm !== undefined) {
        for (const g of [L.flowG, L.crestG, L.foamG, L.grainG, L.rainG, L.purrG, L.padG, this.rushG, this.leafG]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.15); }
        L.hiF.frequency.cancelScheduledValues(t); L.hiF.frequency.setValueAtTime(20000, t + 0.05);
        this.flapT = 0;
      }
      this.lastForm = key;
    }
    const wet = f === 'fish' || f === 'flow';
    set(L.flowG, wet ? 0.06 + Math.min(0.22, v * 0.025) : 0);
    L.flowF.frequency.setTargetAtTime(260 + v * 45, t, 0.3);
    if (wet && Math.random() < 0.006 + v * 0.002) this.bubbles();
    const crest = f === 'wave' ? Math.min(1, v / 9) : 0;
    set(L.crestG, crest * 0.22); set(L.foamG, crest * crest * 0.05);
    L.crestF.frequency.setTargetAtTime(300 + crest * 700, t, 0.5);
    // sabbia: il fruscio va a folate irregolari, come il vento che la spinge
    if (f === 'sand') { if (Math.random() < 0.08) L.grainF.frequency.setTargetAtTime(3800 + Math.random() * 3000, t, 0.3); set(L.grainG, (0.01 + Math.min(0.045, v * 0.005)) * (0.5 + Math.random()), 0.25); if (Math.random() < 0.05) this._grains(0.012); }
    else set(L.grainG, 0);
    const rainy = f === 'rain' || s.raining;
    set(L.rainG, rainy ? (f === 'rain' ? 0.06 : 0.04) + Math.random() * 0.03 : 0, 0.15);
    if (rainy) this._grains(f === 'rain' ? 0.02 : 0.012, 3 + (Math.random() * 4 | 0));
    if (rainy && Math.random() < 0.06) L.rainF.frequency.setTargetAtTime(1600 + Math.random() * 1800, t, 0.4);
    set(L.purrG, s.cat && v < 0.3 ? 0.07 : 0, 0.8);
    set(L.padG, f === 'light' ? 0.02 + 0.015 * Math.sin(t * 0.21) * Math.sin(t * 0.13) : 0, 1.5);
    // in alto (nuvola, gabbiano molto alto) l'aria assorbe gli acuti del mondo sotto
    L.hiF.frequency.setTargetAtTime(f === 'cloud' ? 3200 : f === 'tree' ? 11000 : 20000, t, 0.8);
    if (f === 'tree' && Math.random() < 0.004 * (0.3 + this.windBoost)) this._creak();
    if (f === 'gull') {
      this.flapT = (this.flapT || 0) + (s.flapRate || 0) * dtA * (this.flapJ || 1);
      if (this.flapT > 1) { this.flapT = 0; this.flapJ = 0.75 + Math.random() * 0.5; this.flap((s.flapRate > 1 ? 0.8 : 0.35) * (0.7 + Math.random() * 0.5)); }
    }
  }

  // un colpo d'ala: aria spinta, piume
  flap(vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, { bp, gain } = this.mk;
    // colpo verso il basso: aria spinta (sordo), poi il fruscio delle penne
    const s = this._src('brown'), f = bp(180, 0.9), g = gain(0);
    const fv = 0.8 + Math.random() * 0.4;
    f.frequency.setValueAtTime(140 * fv, t); f.frequency.exponentialRampToValueAtTime(420 * fv, t + 0.09); f.frequency.exponentialRampToValueAtTime(160 * fv, t + 0.28);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    s.connect(f); f.connect(g); g.connect(this.master); s.stop(t + 0.35);
    const s2 = this._src('white'), f2 = bp(4200, 1.2), g2 = gain(0);
    g2.gain.setValueAtTime(0.0001, t + 0.03); g2.gain.linearRampToValueAtTime(0.02 * vol, t + 0.07); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s2.connect(f2); f2.connect(g2); g2.connect(this.master); s2.stop(t + 0.25);
  }

  // goccia singola (pioggia): un piccolo "plic"
  _drop(vol) {
    const t = this.ctx.currentTime + Math.random() * 0.05, { gain } = this.mk;
    const o = this.ctx.createOscillator(), f0 = 1800 + Math.random() * 2800;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.02);
    const g = gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.04);
  }

  // il legno che scricchiola nel vento: tanti piccoli attriti in fila, risonanti nel tronco
  _creak() {
    const t0 = this.ctx.currentTime, { bp, gain } = this.mk;
    const res = bp(380 + Math.random() * 500, 9), out = gain(0.9); res.connect(out); out.connect(this.master);
    let t = t0, rate = 25 + Math.random() * 30;
    const len = 0.5 + Math.random() * 0.8;
    while (t < t0 + len) {
      const s = this._src('white', 1, Math.random() * 2), g = gain(0);
      const a = 0.05 * Math.sin(Math.PI * (t - t0) / len) * (0.6 + Math.random() * 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
      s.connect(g); g.connect(res); s.stop(t + 0.012);
      rate *= 0.97 + Math.random() * 0.08; t += 1 / rate;
    }
  }

  // granelli: piccoli impulsi di rumore (pioggia, sabbia), mai uguali
  _grains(vol, n = 2) {
    const t0 = this.ctx.currentTime, { bp, gain } = this.mk;
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * 0.06, s = this._src('white', 1, Math.random() * 2.5), f = bp(1200 + Math.random() * 5000, 1 + Math.random() * 2), g = gain(0);
      const a = vol * (0.3 + Math.random() * 0.7), len = 0.006 + Math.random() * 0.02;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f); f.connect(g); g.connect(this.master); s.stop(t + len + 0.01);
    }
  }


  // ---------------------------------------------------------------- mare
  _src(name, rate = 1, off = 0) { const s = this.ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate; s.start(this.ctx.currentTime, off || Math.random() * 2); return s; }
  _pan(p) { const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(this.master); return n; }

  _crash(vol, pan, size) {
    const ctx = this.ctx, t = ctx.currentTime, { lp, bp, gain } = this.mk;
    const out = this._pan(pan);
    // corpo: rombo che cresce e si scioglie
    const a = this._src('brown', 0.9), af = lp(250), ag = gain(0);
    af.frequency.setValueAtTime(250, t); af.frequency.linearRampToValueAtTime(900 + 600 * size, t + 0.45); af.frequency.exponentialRampToValueAtTime(320, t + 3.2);
    ag.gain.setValueAtTime(0.0001, t); ag.gain.linearRampToValueAtTime(vol, t + 0.35); ag.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    a.connect(af); af.connect(ag); ag.connect(out); a.stop(t + 3.8);
    // schiuma che frigge
    const b = this._src('white'), bf = bp(3200, 0.5), bg = gain(0);
    bg.gain.setValueAtTime(0.0001, t + 0.2); bg.gain.linearRampToValueAtTime(vol * 0.35, t + 0.6); bg.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    b.connect(bf); bf.connect(bg); bg.connect(out); b.stop(t + 3.2);
  }

  _swash(vol, pan) {
    const ctx = this.ctx, t = ctx.currentTime, { bp, hp, gain } = this.mk;
    const out = this._pan(pan);
    const s = this._src('pink'), f = bp(1500, 0.6), h = hp(500), g = gain(0);
    f.frequency.setValueAtTime(1200, t); f.frequency.linearRampToValueAtTime(3800, t + 1.2); f.frequency.linearRampToValueAtTime(2000, t + 2.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.4); g.gain.linearRampToValueAtTime(vol * 0.6, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    s.connect(h); h.connect(f); f.connect(g); g.connect(out); s.stop(t + 2.6);
  }

  // il ritiro dell'onda che trascina i ciottoli: tanti piccoli clic
  _pebbles(vol, pan, dur) {
    const ctx = this.ctx, t0 = ctx.currentTime, { bp, gain } = this.mk;
    const out = this._pan(pan);
    const n = 70;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const t = t0 + Math.pow(k, 0.8) * dur + Math.random() * 0.05;
      const s = this._src('white', 1, Math.random() * 2.5);
      const f = bp(2200 + Math.random() * 4000, 3 + Math.random() * 4), g = gain(0);
      const a = vol * (1 - k) * (0.3 + Math.random() * 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.03);
      s.connect(f); f.connect(g); g.connect(out); s.stop(t + 0.08);
    }
  }

  // ---------------------------------------------------------------- passi
  step(kind, speed) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, { lp, bp, hp, gain } = this.mk;
    const v = Math.min(1, 0.4 + speed / 7);
    const out = this.master;
    const grain = (at, f, q, a, len) => {
      const s = this._src('white', 1, Math.random() * 2.5), bf = bp(f, q), g = gain(0);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(a, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      s.connect(bf); bf.connect(g); g.connect(out); s.stop(at + len + 0.02);
    };
    const thump = (f, a, len) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + len * 0.5);
      const g = gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
    };
    if (kind === 'sand') {
      // scricchiolio granulare: il tacco poi la punta
      for (let i = 0; i < 9; i++) grain(t + (i < 4 ? i * 0.012 : 0.07 + (i - 4) * 0.014) + Math.random() * 0.008, 1600 + Math.random() * 2600, 1.3, 0.05 * v * (0.5 + Math.random() * 0.5), 0.02 + Math.random() * 0.02);
      thump(75, 0.05 * v, 0.06);
    } else if (kind === 'wet') {
      const s = this._src('pink'), f = lp(700), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      s.connect(f); f.connect(g); g.connect(out); s.stop(t + 0.2);
      for (let i = 0; i < 4; i++) grain(t + 0.03 + i * 0.02, 900 + Math.random() * 900, 2, 0.02 * v, 0.03);
      thump(65, 0.06 * v, 0.07);
    } else if (kind === 'wood') {
      thump(150 + Math.random() * 30, 0.14 * v, 0.16);
      grain(t, 420, 4, 0.06 * v, 0.07);
      grain(t, 3200, 2, 0.03 * v, 0.015);
    } else if (kind === 'concrete') {
      grain(t, 2800, 1.5, 0.07 * v, 0.02);
      grain(t + 0.06, 3600, 1.5, 0.05 * v, 0.018);
      thump(110, 0.05 * v, 0.06);
    } else if (kind === 'grass') {
      for (let i = 0; i < 12; i++) grain(t + Math.random() * 0.12, 2400 + Math.random() * 3500, 0.8, 0.025 * v, 0.03 + Math.random() * 0.04);
      thump(70, 0.035 * v, 0.06);
    } else if (kind === 'rock') {
      grain(t, 2000, 3, 0.08 * v, 0.02);
      thump(95, 0.07 * v, 0.07);
    } else if (kind === 'paw') {
      // zampe: quasi niente, un fruscio morbido
      for (let i = 0; i < 4; i++) grain(t + Math.random() * 0.03, 2200 + Math.random() * 2000, 1, 0.012 * v, 0.02);
      thump(90, 0.012 * v, 0.03);
    } else if (kind === 'water') {
      this.splash('stroke', 0.6 * v);
    }
  }

  setUnder(k) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, { lp, gain } = this.mk;
    this.muffle.frequency.setTargetAtTime(k > 0.5 ? 380 : 20000, t, 0.08);
    if (!this.underG) {
      this.underG = gain(0);
      const s = this._src('brown', 0.6); s.loop = true;
      const f = lp(160);
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 38;
      s.connect(f); f.connect(this.underG); o.connect(this.underG); this.underG.connect(this.comp);
      o.start();
    }
    this.underG.gain.setTargetAtTime(k > 0.5 ? 0.2 : 0, t, 0.15);
  }

  // bracciata, pagaiata, tuffo
  splash(kind = 'stroke', vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, { bp, lp, gain } = this.mk;
    const s = this._src('pink'), f = bp(kind === 'dive' ? 500 : 1100 + Math.random() * 500, 0.9), g = gain(0);
    f.frequency.setValueAtTime(kind === 'dive' ? 600 : 1300 + Math.random() * 600, t);
    f.frequency.exponentialRampToValueAtTime(kind === 'paddle' ? 450 : 280, t + 0.4);
    const len = kind === 'dive' ? 1.1 : kind === 'paddle' ? 0.55 : 0.45;
    const v = (kind === 'dive' ? 0.4 : kind === 'paddle' ? 0.18 : 0.13) * vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.master); s.stop(t + len + 0.05);
    if (kind === 'dive') { // tonfo
      const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
      const og = gain(0); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.2 * vol, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      const of = lp(300); o.connect(of); of.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.35);
    }
    // goccioline
    for (let i = 0; i < (kind === 'dive' ? 10 : 4); i++) {
      const tt = t + 0.08 + Math.random() * (kind === 'dive' ? 0.8 : 0.3);
      const o = this.ctx.createOscillator(); const f0 = 900 + Math.random() * 1800;
      o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f0 * 1.6, tt + 0.03);
      const og = gain(0); og.gain.setValueAtTime(0.0001, tt); og.gain.linearRampToValueAtTime(0.015 * vol, tt + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.04);
      o.connect(og); og.connect(this.master); o.start(tt); o.stop(tt + 0.05);
    }
  }

  bubbles() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime, { gain } = this.mk;
    const nb = 2 + (Math.random() * 6 | 0);
    for (let i = 0; i < nb; i++) {
      const t = t0 + i * (0.03 + Math.random() * 0.12);
      const o = ctx.createOscillator(); o.type = 'sine';
      const f0 = 250 + Math.random() * 600;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.07);
      const g = gain(0); g.gain.setValueAtTime(0.0001, t); const bv = 0.015 + Math.random() * 0.035; g.gain.linearRampToValueAtTime(bv, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.08);
      o.connect(g); g.connect(this.comp); o.start(t); o.stop(t + 0.1);
    }
  }

  // Voci di gabbiano costruite campione per campione: impulsi glottali irregolari, raddoppio di periodo
  // (la raucedine tipica), soffio, poi formanti nasali. Niente oscillatori puliti: suona come una gola, non come un synth.
  _gullBank() {
    const ctx = this.ctx, sr = ctx.sampleRate, out = [];
    const bq = (x, f, Q) => { const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * Q), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0; const y = new Float32Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
    for (let v = 0; v < 7; v++) {
      const notes = [];
      const f0 = 520 + Math.random() * 260;
      if (v % 3 !== 2) notes.push({ len: 0.38 + Math.random() * 0.22, up: 1.22, down: 0.62, rough: 0.55, gap: 0.09 });
      const nh = v % 3 === 1 ? 0 : 2 + (Math.random() * 4 | 0);
      for (let i = 0; i < nh; i++) notes.push({ len: 0.1 + Math.random() * 0.05, up: 1.1, down: 0.8, rough: 0.35, gap: 0.05 + Math.random() * 0.05 });
      const total = notes.reduce((a, n) => a + n.len + n.gap, 0.05);
      const x = new Float32Array(Math.ceil(total * sr));
      let o = Math.floor(0.02 * sr), ph = 0;
      for (const N of notes) {
        const L = Math.floor(N.len * sr);
        let drift = 0;
        for (let i = 0; i < L; i++) {
          const t = i / L;
          const cont = t < 0.25 ? 0.82 + (N.up - 0.82) * (t / 0.25) : N.up + (N.down - N.up) * Math.pow((t - 0.25) / 0.75, 1.3);
          drift += (Math.random() - 0.5) * 0.004; drift *= 0.995;
          const f = f0 * cont * (1 + drift + (Math.random() - 0.5) * 0.03);
          ph += f / sr;
          const pf = ph % 1;
          // impulso glottale asimmetrico: apertura lenta, chiusura brusca
          let g = pf < 0.55 ? Math.sin(Math.PI * pf / 0.55) ** 2 : 0;
          g -= 0.3;
          const env = Math.min(1, t / 0.06) * Math.pow(1 - t, 0.6) * (1 - 0.25 * Math.sin(t * 40));
          // raddoppio di periodo nella parte forte: un impulso sì e uno più debole
          const sub = (Math.floor(ph) % 2) ? 1 - N.rough * Math.sin(Math.PI * Math.min(1, t * 1.6)) : 1;
          const breath = (Math.random() * 2 - 1) * (0.05 + 0.06 * (1 - t));
          x[o + i] += (g * sub + breath) * env;
        }
        o += L + Math.floor(N.gap * sr);
      }
      // gola e becco: formanti in parallelo, un passa-alto, un po' di saturazione
      const a = bq(x, 1400 + Math.random() * 300, 3), b = bq(x, 2500 + Math.random() * 400, 4), c = bq(x, 3800, 5), d = bq(x, 700, 2);
      const y = new Float32Array(x.length); let mx = 0;
      for (let i = 0; i < x.length; i++) { const s0 = a[i] * 1.2 + b[i] * 0.9 + c[i] * 0.25 + d[i] * 0.12; y[i] = Math.tanh(s0 * 1.6); mx = Math.max(mx, Math.abs(y[i])); }
      const buf = ctx.createBuffer(1, y.length, sr); const ch = buf.getChannelData(0);
      for (let i = 0; i < y.length; i++) ch[i] = y[i] / (mx || 1) * 0.9;
      out.push(buf);
    }
    return out;
  }

  // campioni veri: se nella cartella audio/ c'è manifest.json con { "gull": ["gull1.m4a", ...] } li usa
  async loadSamples() {
    if (this.samples || !this.ctx) return;
    this.samples = {};
    try {
      const r = await fetch('audio/manifest.json'); if (!r.ok) return;
      const man = await r.json();
      for (const [k, list] of Object.entries(man)) {
        this.samples[k] = [];
        for (const f of list) { try { const b = await (await fetch('audio/' + f)).arrayBuffer(); this.samples[k].push(await this.ctx.decodeAudioData(b)); } catch (e) { /* file mancante */ } }
      }
    } catch (e) { /* nessun campione: resta la sintesi */ }
  }
  _sample(k, pan, dist, vol = 1) {
    const L = this.samples && this.samples[k];
    if (!L || !L.length) return false;
    const ctx = this.ctx, { lp, gain } = this.mk;
    const s = ctx.createBufferSource(); s.buffer = L[(Math.random() * L.length) | 0];
    s.playbackRate.value = 0.92 + Math.random() * 0.16;
    const f = lp(Math.max(1200, 14000 - dist * 90)), g = gain(Math.min(0.9, 6 / (dist + 6)) * vol);
    s.connect(f); f.connect(g); g.connect(this._pan(pan)); s.start();
    return true;
  }
  // gabbiano reale (gabbiano reale mediterraneo): un lungo «kiàu» nasale e roco, poi una serie di «ha-ha-ha»
  gull(pan = 0, dist = 30) {
    if (!this.ctx) return;
    if (this._sample('gull', pan, dist)) return;
    if (!this.gullSyn) this.gullSyn = this._gullBank();
    { // voce costruita: con l'aria che la attenua e un po' di eco della riva
      const ctx = this.ctx, { lp, gain } = this.mk;
      const s = ctx.createBufferSource(); s.buffer = this.gullSyn[(Math.random() * this.gullSyn.length) | 0];
      s.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = lp(Math.max(1400, 12000 - dist * 80)), g = gain(Math.min(0.5, 3.2 / (dist + 6)));
      s.connect(f); f.connect(g); g.connect(this._pan(pan)); s.start();
      return;
    }
    const ctx = this.ctx, { bp, lp, hp, gain } = this.mk;
    const vol = Math.min(0.09, 2.0 / (dist + 8));
    if (vol < 0.006) return;
    const p = this._pan(pan);
    const air = lp(Math.max(1400, 10000 - dist * 70)); air.connect(p);
    // corpo nasale: due formanti in parallelo
    const bus = gain(1), f1 = bp(1500, 3.2), f2 = bp(2900, 4), f3 = hp(450), mix = gain(1);
    bus.connect(f1); bus.connect(f2); bus.connect(f3); const g3 = gain(0.25); f3.connect(g3);
    f1.connect(mix); f2.connect(mix); g3.connect(mix); mix.connect(air);
    const f0 = 760 + Math.random() * 220;
    const notes = [];
    if (Math.random() < 0.6) notes.push({ len: 0.42 + Math.random() * 0.2, rise: 1.18, fall: 0.62, a: 1 });
    const n = 2 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) notes.push({ len: 0.11 + Math.random() * 0.04, rise: 1.08, fall: 0.85, a: 0.75 - i * 0.06 });
    let t = ctx.currentTime + 0.02;
    for (const N of notes) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const fr = f0 * (0.97 + Math.random() * 0.06);
      o.frequency.setValueAtTime(fr * 0.86, t);
      o.frequency.linearRampToValueAtTime(fr * N.rise, t + N.len * 0.28);
      o.frequency.exponentialRampToValueAtTime(fr * N.fall, t + N.len);
      // raucedine: modulazione rapida d'ampiezza
      const am = ctx.createOscillator(); am.frequency.value = 70 + Math.random() * 40;
      const amg = gain(0.45), env = gain(0); am.connect(amg); amg.connect(env.gain);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol * N.a, t + 0.02);
      env.gain.setValueAtTime(vol * N.a, t + N.len * 0.6); env.gain.exponentialRampToValueAtTime(0.0001, t + N.len);
      o.connect(env); env.connect(bus);
      // soffio nella voce
      const ns = this._src('white'), nf = bp(2600, 1.5), ng = gain(0);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.25 * N.a, t + 0.02); ng.gain.exponentialRampToValueAtTime(0.0001, t + N.len);
      ns.connect(nf); nf.connect(ng); ng.connect(air);
      o.start(t); am.start(t); o.stop(t + N.len + 0.05); am.stop(t + N.len + 0.05); ns.stop(t + N.len + 0.05);
      t += N.len + (N.len > 0.3 ? 0.12 : 0.06 + Math.random() * 0.04);
    }
  }


  // ---------------------------------------------------------------- motori
  _engine(cfg) {
    const ctx = this.ctx, { lp, bp, gain } = this.mk;
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) { const a = Math.pow(k, -cfg.tilt) * (1 + (k % 2 ? cfg.odd : 0)); const ph = Math.random() * 6.28; re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph); }
    const wave = ctx.createPeriodicWave(re, im);
    const osc = ctx.createOscillator(); osc.setPeriodicWave(wave);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * cfg.drive) / Math.tanh(cfg.drive); }
    shaper.curve = curve;
    const tone = lp(800, 1.2);
    const out = gain(0);
    osc.connect(shaper); shaper.connect(tone); tone.connect(out);
    // scarico: rumore pulsato a ogni scoppio
    const ex = this._src('brown', 1); ex.loop = true;
    const exF = bp(cfg.exhaust, 0.8), exG = gain(0);
    const pulse = ctx.createOscillator(); pulse.type = 'square';
    const pulseG = gain(0.5);
    pulse.connect(pulseG); pulseG.connect(exG.gain);
    ex.connect(exF); exF.connect(exG); exG.connect(out);
    // fischio (aspirazione o piede del fuoribordo)
    const wh = ctx.createOscillator(); wh.type = 'sine'; const whG = gain(0); wh.connect(whG); whG.connect(out);
    out.connect(this.master);
    osc.start(); pulse.start(); wh.start();
    return { osc, tone, out, pulse, exG, wh, whG, rpm: cfg.idle, cfg };
  }

  // moto: monocilindrico a 4 tempi con cinque marce
  engine(on, speed, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.bike && on) this.bike = this._engine({ tilt: 0.75, odd: 0.4, drive: 2.6, exhaust: 260, idle: 1400 });
    if (!this.bike) return;
    const E = this.bike;
    const gears = [0, 7, 12, 17, 23, 30];
    const v = Math.abs(speed);
    let g = 1; while (g < 5 && v > gears[g]) g++;
    const lo = gears[g - 1], hi = gears[g];
    let target = on ? 1400 + Math.max(0, (v - lo) / (hi - lo)) * 6800 + (g === 1 ? v * 300 : 2200) + throttle * 900 : 0;
    if (on && v < 0.5) target = 1400 + throttle * 2500;
    if (E.gear !== undefined && g > E.gear && on) { E.rpm *= 0.68; this._pop(0.05); }
    E.gear = g;
    E.rpm += (target - E.rpm) * Math.min(1, 0.12);
    const fire = Math.max(8, E.rpm / 120);
    E.osc.frequency.setTargetAtTime(fire, t, 0.04);
    E.pulse.frequency.setTargetAtTime(fire, t, 0.04);
    E.wh.frequency.setTargetAtTime(fire * 9, t, 0.05);
    E.tone.frequency.setTargetAtTime(500 + E.rpm * 0.35 + throttle * 1800, t, 0.06);
    E.exG.gain.setTargetAtTime(on ? 0.05 + throttle * 0.08 : 0, t, 0.05);
    E.whG.gain.setTargetAtTime(on ? 0.004 * throttle : 0, t, 0.1);
    E.out.gain.setTargetAtTime(on ? 0.06 + throttle * 0.05 : 0, t, on ? 0.08 : 0.5);
    // scoppiettii in rilascio
    if (on && throttle === 0 && E.rpm > 4000 && Math.random() < 0.08) this._pop(0.04);
  }

  // fuoribordo: due tempi, più acuto, con lo scafo che batte sull'onda
  boatEngine(on, speed, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.boat && on) {
      this.boat = this._engine({ tilt: 0.6, odd: 0.1, drive: 1.8, exhaust: 520, idle: 1000 });
      const { bp, gain } = this.mk;
      const w = this._src('pink'); w.loop = true; this.boatWaterF = bp(500, 0.7); this.boatWaterG = gain(0);
      w.connect(this.boatWaterF); this.boatWaterF.connect(this.boatWaterG); this.boatWaterG.connect(this.master);
    }
    if (!this.boat) return;
    const E = this.boat, v = Math.abs(speed);
    const target = on ? 1000 + Math.min(1, v / 14) * 3800 + throttle * 900 : 0;
    E.rpm += (target - E.rpm) * 0.08;
    const fire = Math.max(12, E.rpm / 60);
    E.osc.frequency.setTargetAtTime(fire, t, 0.05);
    E.pulse.frequency.setTargetAtTime(fire, t, 0.05);
    E.wh.frequency.setTargetAtTime(fire * 6.5, t, 0.05);
    E.tone.frequency.setTargetAtTime(900 + E.rpm * 0.5, t, 0.08);
    E.exG.gain.setTargetAtTime(on ? 0.03 + throttle * 0.04 : 0, t, 0.06);
    E.whG.gain.setTargetAtTime(on ? 0.006 + 0.01 * throttle : 0, t, 0.1);
    E.out.gain.setTargetAtTime(on ? 0.05 + throttle * 0.04 : 0, t, on ? 0.1 : 0.6);
    this.boatWaterG.gain.setTargetAtTime(on ? Math.min(0.14, v * 0.012) : 0, t, 0.2);
    this.boatWaterF.frequency.setTargetAtTime(400 + v * 60, t, 0.2);
    // lo scafo che batte sulle onde
    if (on && v > 5 && Math.random() < 0.012 * v) {
      const { lp, gain } = this.mk;
      const s = this._src('brown'), f = lp(220), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      s.connect(f); f.connect(g); g.connect(this.master); s.stop(t + 0.3);
    }
  }

  _pop(vol) {
    const t = this.ctx.currentTime, { bp, gain } = this.mk;
    const s = this._src('white'), f = bp(700 + Math.random() * 500, 1.5), g = gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(this.master); s.stop(t + 0.08);
  }

  // ---------------------------------------------------------------- rintocchi
  chime(i) {
    if (!this.ctx) return;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const f = 392 * Math.pow(2, scale[i % scale.length] / 12);
    this._bell(f, 0.2);
  }

  chord() {
    if (!this.ctx) return;
    [196, 293.66, 392, 587.33].forEach((f, k) => setTimeout(() => this._bell(f, 0.12), k * 90));
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

  wind(k) { this.windBoost = k; }

  toggle() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
