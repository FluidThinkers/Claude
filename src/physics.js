// Ostacoli fisici: cerchi (tronchi, pali, piloni) e scatole (cabine, muretti).
// Il giocatore e i mezzi vengono spinti fuori; i mezzi rimbalzano.

export class Physics {
  constructor() {
    this.statics = [];   // { x, z, r, top, bottom }
    this.dynamic = [];   // ricostruiti al volo (alberi, palme)
    this.grid = new Map();
  }
  add(x, z, r, top = 99, bottom = -99) { this.statics.push({ x, z, r, top, bottom }); this.grid = null; }
  setDynamic(list) { this.dynamic = list; }

  _cells() {
    if (this.grid) return this.grid;
    this.grid = new Map();
    for (const c of this.statics) {
      const k = `${Math.floor(c.x / 20)},${Math.floor(c.z / 20)}`;
      (this.grid.get(k) || this.grid.set(k, []).get(k)).push(c);
    }
    return this.grid;
  }

  *_near(x, z) {
    const g = this._cells();
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = g.get(`${cx + i},${cz + j}`); if (l) yield* l; }
    yield* this.dynamic;
  }

  // spinge fuori; ritorna la normale del contatto (o null)
  resolve(pos, radius, feet, head) {
    let hit = null;
    for (const c of this._near(pos.x, pos.z)) {
      if (feet > c.top || head < c.bottom) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), m = c.r + radius;
      if (d < m && d > 1e-5) {
        pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m;
        hit = { nx: dx / d, nz: dz / d };
      }
    }
    return hit;
  }
}
