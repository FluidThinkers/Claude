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
    this.droneG.gain.setTargetAtTime(0, t, 1.0); // niente ronzio
    this.verbSend.gain.setTargetAtTime(s.reverb ?? 0.04, t, 0.4);
    this._beds(s, t, near, far);
    this._form(s, t);
  }

  // ambienti registrati: mare, vento, alberi, sott'acqua, pioggia, grilli, colonia di gabbiani
  _beds(s, t, near, far) {
    const B = this.beds; if (!B) return;
    const set = (k, v, tc = 0.6) => { if (B[k]) B[k].gain.setTargetAtTime(v, t, tc); };
    const w = this.windBoost, ex = s.exposure ?? 1, f = s.form || '';
    const day = 1 - (s.night || 0), onLand = s.shoreDist > 4;
    set('sea', (0.16 + 0.34 * near) * far * (s.under ? 0.15 : 1));
    set('wind', (0.03 + 0.32 * w * w) * ex * (s.under ? 0 : 1));
    set('trees', (f === 'tree' ? 0.5 : (s.trees || 0) * (0.08 + 0.35 * w)) * (s.under ? 0 : 1));
    set('under', s.under ? 0.55 : 0, 0.15);
    set('purr', s.cat && (s.formSpeed || 0) < 0.3 ? 0.4 : 0, 0.8);
    set('rain', (f === 'rain' || s.raining) && !s.under ? (f === 'rain' ? 0.5 : 0.35) : 0, 0.8);
    set('night', onLand && !s.under ? 0.22 * Math.max(0, (s.night || 0) - 0.3) : 0, 1.5);
    set('gulls', day * Math.exp(-Math.abs(s.shoreDist) / 70) * (s.under ? 0 : 0.07) * (f === 'cloud' ? 0.3 : 1), 1.5);
    // con le registrazioni, i suoni generati restano solo come dettaglio
    this.bedG.gain.setTargetAtTime(0.05 * far, t, 0.5);
    this.windLowG.gain.setTargetAtTime(0.02 * ex, t, 0.6); this.windWhG.gain.setTargetAtTime(0.004 * Math.pow(w, 3) * ex, t, 0.5);
    this.leafG.gain.setTargetAtTime(0, t, 0.3);
    if (this.underG) this.underG.gain.setTargetAtTime(s.under ? 0.06 : 0, t, 0.15);
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
    set(L.rainG, rainy ? ((f === 'rain' ? 0.06 : 0.04) + Math.random() * 0.03) * (this.beds && this.beds.rain ? 0.3 : 1) : 0, 0.15);
    if (rainy) this._grains(f === 'rain' ? 0.02 : 0.012, 3 + (Math.random() * 4 | 0));
    if (rainy && Math.random() < 0.06) L.rainF.frequency.setTargetAtTime(1600 + Math.random() * 1800, t, 0.4);
    set(L.purrG, s.cat && v < 0.3 && !(this.beds && this.beds.purr) ? 0.07 : 0, 0.8);
    set(L.padG, f === 'light' ? 0.02 + 0.015 * Math.sin(t * 0.21) * Math.sin(t * 0.13) : 0, 1.5);
    // in alto (nuvola, gabbiano molto alto) l'aria assorbe gli acuti del mondo sotto
    L.hiF.frequency.setTargetAtTime(f === 'cloud' ? 3200 : f === 'tree' ? 11000 : 20000, t, 0.8);
    if (f === 'tree' && Math.random() < 0.004 * (0.3 + this.windBoost)) this._creak();
    if (f === 'gull') {
      this.flapT = (this.flapT || 0) + (s.flapRate || 0) * dtA * (this.flapJ || 1);
      if (this.flapT > 1) { this.flapT = 0; this.flapJ = 0.75 + Math.random() * 0.5; this.flap((s.flapRate > 1 ? 0.8 : 0.35) * (0.7 + Math.random() * 0.5)); }
    }
  }

  // sotto la voce narrante: un accordo caldo e lontano, che sale piano e se ne va piano
  narr(on) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, { lp, gain } = this.mk;
    if (!this.narrG) {
      this.narrG = gain(0); const f = lp(760, 0.4); f.connect(this.narrG); this.narrG.connect(this.master); this.narrG.connect(this.fx);
      for (const [fr, a] of [[110, 0.5], [164.8, 0.35], [220, 0.3], [277.2, 0.18], [329.6, 0.12]]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (Math.random() - 0.5) * 10;
        const g = gain(a); const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.08; const lg = gain(a * 0.35); lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(f); o.start(); lfo.start();
      }
    }
    this.narrG.gain.cancelScheduledValues(t); this.narrG.gain.setValueAtTime(this.narrG.gain.value, t);
    this.narrG.gain.linearRampToValueAtTime(0, t + 0.5); // niente accordo sintetico sotto la voce
    this.duck(on);
  }

  // musica: brani veri (audio/musica/<nome>.mp3), usati a pezzi nei momenti giusti, con dissolvenze lunghe
  async music(cue) {
    if (!this.ctx || this.cue === cue) return;
    this.cue = cue;
    if (!this.musicMan) { try { this.musicMan = await (await fetch('audio/musica/manifest.json')).json(); } catch (e) { this.musicMan = {}; } }
    const f = this.musicMan[cue]; const t = this.ctx.currentTime;
    if (this.musicNow) { const old = this.musicNow; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + 4); setTimeout(() => { try { old.s.stop(); } catch (e) {} }, 4500); this.musicNow = null; }
    if (!f) return;
    try {
      this.musicBufs ||= {};
      if (!this.musicBufs[f]) { const b = await (await fetch('audio/musica/' + f)).arrayBuffer(); this.musicBufs[f] = await new Promise((ok, ko) => this.ctx.decodeAudioData(b, ok, ko)); }
      if (this.cue !== cue) return;
      const src = this.ctx.createBufferSource(); src.buffer = this.musicBufs[f]; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.comp);
      const t2 = this.ctx.currentTime; g.gain.linearRampToValueAtTime(this.musicVol ?? 0.32, t2 + 5);
      src.start(0, Math.random() * Math.max(0, src.buffer.duration - 30) * 0.3);
      this.musicNow = { s: src, g };
    } catch (e) { /* manca il brano */ }
  }
  // la musica si abbassa mentre parla la voce
  duck(on) { if (this.musicNow) { const t = this.ctx.currentTime; this.musicNow.g.gain.setTargetAtTime(on ? 0.12 : (this.musicVol ?? 0.32), t, 0.8); } }

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
      s.connect(f); f.connect(this.underG); this.underG.connect(this.comp);
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

  // campioni veri: se nella cartella audio/ c'è manifest.json con { "gull": ["gull1.m4a", ...] } li usa
  async loadSamples() {
    if (this.samples || !this.ctx) return;
    this.samples = {};
    try {
      const r = await fetch('audio/manifest.json'); if (!r.ok) return;
      const man = await r.json();
      const dec = async (f) => { const b = await (await fetch('audio/' + f)).arrayBuffer(); return await new Promise((ok, ko) => this.ctx.decodeAudioData(b, ok, ko)); };
      for (const [k, list] of Object.entries(man)) {
        if (k === 'beds') continue;
        this.samples[k] = [];
        for (const f of list) { try { this.samples[k].push(await dec(f)); } catch (e) { /* file mancante */ } }
      }
      // ambienti registrati: in loop, il volume lo decide update()
      this.beds = {};
      for (const [k, f] of Object.entries(man.beds || {})) {
        try {
          const buf = await dec(f);
          const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
          const g = this.ctx.createGain(); g.gain.value = 0;
          src.connect(g); g.connect(k === 'under' ? this.comp : this.master);
          src.start(0, Math.random() * buf.duration);
          this.beds[k] = g;
        } catch (e) { /* manca */ }
      }
    } catch (e) { /* nessun campione: resta la sintesi */ }
  }
  _sample(k, pan, dist, vol = 1) {
    const L = this.samples && this.samples[k];
    if (!L || !L.length) return false;
    const ctx = this.ctx, { lp, gain } = this.mk;
    const s = ctx.createBufferSource(); s.buffer = L[(Math.random() * L.length) | 0];
    s.playbackRate.value = 0.92 + Math.random() * 0.16;
    const f = lp(Math.max(1200, 14000 - dist * 90)), g = gain(Math.min(0.7, 5 / (dist + 7)) * vol);
    s.connect(f); f.connect(g); g.connect(this._pan(pan)); s.start();
    return true;
  }
  // gabbiano reale (gabbiano reale mediterraneo): un lungo «kiàu» nasale e roco, poi una serie di «ha-ha-ha»
  gull(pan = 0, dist = 30) {
    if (!this.ctx) return;
    // solo registrazioni vere; mai due versi uno sopra l'altro
    const now = this.ctx.currentTime;
    if (now - (this.lastGull || 0) < 1.4 || dist > 120) return;
    if (this._sample('gull', pan, dist, 0.8)) this.lastGull = now;
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
