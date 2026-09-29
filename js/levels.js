// Math Quest Runner: level generator. Levels are built from a seed, so every player gets the same three levels.
// Depends on MQR.Math.rng (math.js). Pure logic, no DOM.
window.MQR = window.MQR || {};
(function () {
  'use strict';
  const T = 16, ROWS = 17, BOTTOM = ROWS - 1;

  const CONFIGS = [
    { id: 1, name: 'Sunny Clearing', theme: 'sunny', seed: 1101, length: 150, maxGap: 3, gremlinSpeed: 18, platformRate: 0.24, hint: 'Bright open jungle. Watch out for the little frogs!' },
    { id: 2, name: 'Ancient Ruins', theme: 'ruins', seed: 2202, length: 165, maxGap: 3, gremlinSpeed: 24, platformRate: 0.30, movers: { high: 0.6, bridge: 0.6 }, moverSpeed: 22, hint: 'Mossy temple stones and higher platforms.' },
    { id: 3, name: 'Amazon River Canopy', theme: 'river', seed: 3303, length: 180, maxGap: 4, gremlinSpeed: 30, platformRate: 0.30, movers: { high: 0.7, bridge: 0.7, bob: 0.6 }, moverSpeed: 28, hint: 'Wide gaps over the river. Time your jumps.' },
  ];

  function build(cfg) {
    const rnd = MQR.Math.rng(cfg.seed);
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const BIG = cfg.length + 120;                 // room to build in; trimmed to the real length at the end
    const work = new Uint8Array(BIG * ROWS);
    const flats = [];          // { c0, c1, s } stretches of ground
    const gaps = [];           // { c0, c1, s }
    const platforms = [];      // { c0, c1, r }
    let x = 0, s = 12;

    const ground = (c0, c1, row) => {
      for (let c = c0; c < c1; c++) for (let r = row; r <= BOTTOM; r++) work[r * BIG + c] = 1;
    };
    const platform = (c0, c1, r, kind) => {
      for (let c = c0; c < c1; c++) work[r * BIG + c] = 2;
      platforms.push({ c0, c1, r, kind });
    };
    const flat = (n) => { ground(x, x + n, s); flats.push({ c0: x, c1: x + n, s }); x += n; };

    flat(12);                                        // safe start area
    let sinceGap = 99;
    while (x < cfg.length) {
      const roll = rnd();
      if (roll < 0.30 && sinceGap >= 1) {            // a gap, with a run-up before and a landing after
        const k = int(2, cfg.maxGap);
        gaps.push({ c0: x, c1: x + k, s });
        if (k >= 3 && rnd() < 0.5) platform(x, x + k, s - 3, 'bridge');
        x += k;
        const ds = [-1, 0, 0, 1][int(0, 3)];
        s = Math.max(9, Math.min(13, s + ds));
        flat(int(5, 8));
        sinceGap = 0;
      } else if (roll < 0.46) {                       // a cliff up or down
        const ds = [-2, -1, 1, 2][int(0, 3)];
        s = Math.max(9, Math.min(13, s + ds));
        flat(int(6, 9));
        sinceGap++;
      } else if (roll < 0.46 + cfg.platformRate) {    // flat ground with a staircase of floating platforms
        const n = int(10, 14);
        const c0 = x;
        flat(n);
        const first = c0 + 2;
        platform(first, first + 4, s - 3, 'low');
        if (rnd() < 0.7 && s - 6 >= 3) platform(first + 5, first + 9, s - 6, 'high');
        sinceGap++;
      } else {                                        // plain ground
        flat(int(7, 11));
        sinceGap++;
      }
    }
    // Make sure there are enough long, flat stretches for the gremlins.
    const long = () => flats.filter((f) => f.c1 - f.c0 >= 9 && f.c0 > 14);
    while (long().length < 9) { flat(10); }
    flat(12);                                          // finish area
    const endC0 = x - 12;
    const cols = x + 1;                                // the map ends right after the finish area (the edge acts as a wall)
    // Moving platforms: some floating platforms become movers. The terrain is untouched (a separate rng makes the choices, so
    // every seed keeps its layout) and movers are optional shortcuts, so every level stays finishable with plain jumps.
    const movers = [];
    if (cfg.movers) {
      const mr = MQR.Math.rng((cfg.seed ^ 0x51ed270b) >>> 0), chance = (p) => mr() < p, sp = cfg.moverSpeed || 24;
      platforms.forEach((pl) => {
        const w = (pl.c1 - pl.c0) * T, clear = () => { for (let c = pl.c0; c < pl.c1; c++) work[pl.r * BIG + c] = 0; };
        if (pl.kind === 'high' && chance(cfg.movers.high || 0)) {          // slides left and right
          clear(); movers.push({ kind: 'h', x: pl.c0 * T, y: pl.r * T, w, min: pl.c0 * T - 24, max: pl.c0 * T + 24, speed: sp, dir: chance(0.5) ? 1 : -1 });
        } else if (pl.kind === 'low' && chance(cfg.movers.bob || 0)) {     // bobs up and down
          clear(); movers.push({ kind: 'v', x: pl.c0 * T, y: pl.r * T, w, min: pl.r * T - 24, max: pl.r * T + 24, speed: sp * 0.7, dir: chance(0.5) ? 1 : -1 });
        } else if (pl.kind === 'bridge' && chance(cfg.movers.bridge || 0)) { // a ferry that swings across the gap
          clear(); movers.push({ kind: 'h', x: pl.c0 * T - 16 + (chance(0.5) ? 0 : (pl.c1 - pl.c0) * T), y: pl.r * T, w: 32, min: pl.c0 * T - 16, max: pl.c1 * T - 16, speed: sp, dir: 1 });
        }
      });
      movers.forEach((m, i) => { m.id = i; m.dx = 0; m.dy = 0; if (m.kind === 'h' ? m.x >= m.max : m.y >= m.max) m.dir = -1; });
    }
    const tiles = new Uint8Array(cols * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < cols; c++) tiles[r * cols + c] = work[r * BIG + c];
    const flag = { x: (endC0 + 8) * T + 8, y: s * T };
    const start = { x: 3 * T + 8, y: 12 * T };

    // Star coins: 10, spread over the level (platform tops first, then ground and gap arcs).
    const spots = [];
    platforms.forEach((p) => spots.push({ x: ((p.c0 + p.c1) / 2) * T, y: p.r * T - 20, c: (p.c0 + p.c1) / 2 }));
    gaps.forEach((g) => spots.push({ x: ((g.c0 + g.c1) / 2) * T, y: g.s * T - 44, c: (g.c0 + g.c1) / 2 }));
    flats.forEach((f) => { if (f.c0 > 13 && f.c1 - f.c0 >= 6 && f.c1 < endC0) spots.push({ x: ((f.c0 + f.c1) / 2) * T, y: f.s * T - 22, c: (f.c0 + f.c1) / 2 }); });
    spots.sort((a, b) => a.c - b.c);
    const coins = [];
    const usable = spots.filter((p) => p.c > 14 && p.c < endC0 - 4);
    for (let i = 0; i < 10; i++) {
      const idx = Math.min(usable.length - 1, Math.floor(((i + 0.5) / 10) * usable.length));
      const spot = usable[idx];
      if (coins.some((q) => Math.abs(q.x - spot.x) < 40)) { usable.splice(idx, 1); i--; if (usable.length < 3) break; continue; }
      coins.push({ x: spot.x, y: spot.y, taken: false, id: i });
    }
    // Gremlins: 8, on long flat stretches, spread over the level.
    const sites = long().filter((f) => f.c1 < endC0);
    const gremlins = [];
    for (let i = 0; i < 8; i++) {
      const f = sites[Math.min(sites.length - 1, Math.floor(((i + 0.5) / 8) * sites.length))];
      if (gremlins.some((g) => g.site === f)) { continue; }
      gremlins.push({ site: f, left: (f.c0 + 2) * T, right: (f.c1 - 2) * T, x: ((f.c0 + f.c1) / 2) * T, y: f.s * T, dir: rnd() < 0.5 ? -1 : 1, speed: cfg.gremlinSpeed, alive: true, id: gremlins.length });
    }
    // If two picks hit the same stretch, fill up from unused stretches.
    for (const f of sites) { if (gremlins.length >= 8) break; if (!gremlins.some((g) => g.site === f)) gremlins.push({ site: f, left: (f.c0 + 2) * T, right: (f.c1 - 2) * T, x: ((f.c0 + f.c1) / 2) * T, y: f.s * T, dir: 1, speed: cfg.gremlinSpeed, alive: true, id: gremlins.length }); }
    gremlins.forEach((g) => delete g.site);

    return {
      id: cfg.id, name: cfg.name, theme: cfg.theme, hint: cfg.hint, cols, rows: ROWS, tiles, T,
      width: cols * T, height: ROWS * T, start, flag, coins, gremlins, gaps, platforms, flats,
      movers, requirement: { coins: 8, stomps: 6 }, maxGap: cfg.maxGap, seed: cfg.seed,
    };
  }

  // Cheap self-check of the invariants the game relies on. Returns a list of problems (empty = fine).
  function verify(level) {
    const bad = [];
    const solidAt = (c, r) => level.tiles[r * level.cols + c] === 1;
    if (level.coins.length !== 10) bad.push('expected 10 coins, got ' + level.coins.length);
    if (level.gremlins.length !== 8) bad.push('expected 8 gremlins, got ' + level.gremlins.length);
    level.coins.forEach((c) => { const col = Math.floor(c.x / T), row = Math.floor(c.y / T); if (solidAt(col, row)) bad.push('coin ' + c.id + ' is inside a tile'); });
    level.gremlins.forEach((g) => { const col = Math.floor(g.x / T), row = Math.floor(g.y / T); if (!solidAt(col, row) || solidAt(col, row - 1)) bad.push('gremlin ' + g.id + ' is not standing on the ground'); });
    level.gaps.forEach((g) => { if (g.c1 - g.c0 > level.maxGap) bad.push('gap wider than allowed at ' + g.c0); });
    (level.movers || []).forEach((m) => {
      const h = m.kind === 'h';
      if (!(m.w > 0 && m.speed > 0 && m.max > m.min && (h ? m.x >= m.min && m.x <= m.max : m.y >= m.min && m.y <= m.max))) { bad.push('mover ' + m.id + ' is malformed'); return; }
      // The whole area it sweeps (and the space above it for a standing player) must be free of solid tiles.
      const c0 = Math.floor((h ? m.min : m.x) / T), c1 = Math.floor(((h ? m.max : m.x) + m.w - 1) / T);
      const r0 = Math.floor((h ? m.y : m.min) / T) - 3, r1 = Math.floor((h ? m.y : m.max) / T);
      for (let c = c0; c <= c1; c++) for (let r = Math.max(0, r0); r <= r1; r++) if (c < 0 || c >= level.cols || solidAt(c, r)) { bad.push('mover ' + m.id + ' sweeps through solid ground at tile ' + c + ',' + r); return; }
    });
    const startC = Math.floor(level.start.x / T);
    if (!solidAt(startC, Math.floor(level.start.y / T))) bad.push('start is not on the ground');
    if (!solidAt(Math.floor(level.flag.x / T), Math.floor(level.flag.y / T))) bad.push('flag is not on the ground');
    return bad;
  }

  MQR.Levels = { CONFIGS, build, verify, ROWS };
})();