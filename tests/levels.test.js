const fs = require('fs'), vm = require('vm');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/math.js', 'js/physics.js', 'js/levels.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
const { Physics: PH, Levels: LV } = ctx.MQR; const P = PH.P, T = 16;
function run(level, opts) {
  const p = PH.newPlayer(level.start.x, level.start.y); p.canDouble = !!opts.double;
  const dt = 1 / 120; let t = 0, jumpHeld = false, falls = 0, stuck = 0, lastX = p.x;
  while (t < 240) {
    const dir = 1, ahead = p.x + dir * (P.W / 2 + 3);
    let wantJump = false;
    if (p.onGround) {
      const wall = PH.tileAt(level, Math.floor(ahead / T), Math.floor((p.y - 6) / T)) === 1 || PH.tileAt(level, Math.floor(ahead / T), Math.floor((p.y - 20) / T)) === 1;
      const edge = !PH.floorBelow(level, p.x + 5, p.y, 6);
      wantJump = wall || edge;
    } else if (opts.double && p.vy > 0 && p.jumpsUsed === 1 && !PH.floorBelow(level, p.x + 6, p.y, 40)) wantJump = true;   // second jump when falling with nothing below
    const input = { left: false, right: true, jump: wantJump || (!p.onGround && p.vy < 0 && jumpHeld), jumpPressed: wantJump && !jumpHeld };
    jumpHeld = input.jump;
    PH.step(p, input, dt, level); t += dt;
    if (p.dead) { falls++; return { ok: false, why: 'fell at x=' + Math.round(p.x) + ' (tile ' + Math.floor(p.x / T) + ')', t }; }
    if (p.x >= level.flag.x) return { ok: true, t };
    if (Math.abs(p.x - lastX) < 0.5) { stuck += dt; if (stuck > 4) return { ok: false, why: 'stuck at x=' + Math.round(p.x) + ' (tile ' + Math.floor(p.x / T) + ') y=' + Math.round(p.y), t }; } else { stuck = 0; lastX = p.x; }
  }
  return { ok: false, why: 'timeout at x=' + Math.round(p.x), t };
}
let fail = 0;
for (const cfg of LV.CONFIGS) {
  const level = LV.build(cfg); const problems = LV.verify(level);
  const maxGap = Math.max(0, ...level.gaps.map((g) => g.c1 - g.c0));
  const single = run(level, { double: false }), dbl = run(level, { double: true });
  console.log(`L${cfg.id} ${cfg.name}: ${level.cols} cols, ${level.gaps.length} gaps (max ${maxGap}), ${level.platforms.length} platforms, coins ${level.coins.length}, gremlins ${level.gremlins.length}, moving platforms ${level.movers.filter((m) => m.kind !== 'c').length}, crumbling ${level.movers.filter((m) => m.kind === 'c').length}`);
  console.log(`   verify: ${problems.length ? problems.join('; ') : 'ok'} | single-jump bot: ${single.ok ? 'reached the flag in ' + single.t.toFixed(1) + 's' : 'FAILED ' + single.why} | double-jump bot: ${dbl.ok ? 'ok ' + dbl.t.toFixed(1) + 's' : 'FAILED ' + dbl.why}`);
  if (level.movers.filter((m) => m.kind === 'c').length < 1) { console.log('   FAIL: expected at least 1 crumbling platform'); fail++; }
  if (cfg.movers && level.movers.filter((m) => m.kind !== 'c').length < 2) { console.log('   FAIL: expected at least 2 moving platforms'); fail++; }
  if (!cfg.movers && level.movers.some((m) => m.kind !== 'c')) { console.log('   FAIL: level 1 should have no moving platforms'); fail++; }
  if (problems.length || !single.ok || !dbl.ok) fail++;
}
// A wider sweep: many seeds per config must also be completable, so a future config tweak cannot silently break a level.
let sweepFail = 0, sweepN = 0;
for (const cfg of LV.CONFIGS) for (let s = 1; s <= 60; s++) { const level = LV.build(Object.assign({}, cfg, { seed: cfg.seed + s * 7 })); sweepN++; const pr = LV.verify(level); const r = run(level, { double: false }); if (pr.length || !r.ok) { sweepFail++; if (sweepFail <= 5) console.log('  sweep problem', cfg.id, 'seed', cfg.seed + s * 7, pr.join('; '), r.ok ? '' : r.why); } }
console.log(`seed sweep: ${sweepN - sweepFail}/${sweepN} levels pass`); process.exit(fail || sweepFail ? 1 : 0);