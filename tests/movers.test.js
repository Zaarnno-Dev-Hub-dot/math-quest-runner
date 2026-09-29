// Moving-platform physics: landing from above, riding (horizontal and vertical), one-way from below, jumping off, walls.
const fs = require('fs'), vm = require('vm');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/math.js', 'js/physics.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
const PH = ctx.MQR.Physics, T = 16; let bad = 0;
const check = (name, ok, extra) => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

function world(movers, wallCol) {
  const cols = 40, rows = 17, tiles = new Uint8Array(cols * rows);
  for (let r = 14; r < rows; r++) for (let c = 0; c < cols; c++) tiles[r * cols + c] = 1;   // floor, top at y = 224
  if (wallCol) for (let r = 0; r < 14; r++) tiles[r * cols + wallCol] = 1;
  return { cols, rows, tiles, T, width: cols * T, height: rows * T, movers };
}
const mover = (o) => Object.assign({ kind: 'h', x: 200, y: 160, w: 64, min: 120, max: 360, speed: 30, dir: 1, dx: 0, dy: 0 }, o);
const NONE = { left: false, right: false, jump: false, jumpPressed: false };
const run = (p, L, seconds, input) => { for (let i = 0; i < seconds * 120; i++) PH.step(p, input || NONE, 1 / 120, L); };

{   // horizontal: fall onto it, then ride for 2 s
  const m = mover({}), L = world([m]), p = PH.newPlayer(232, 120);
  run(p, L, 0.6); check('lands on a horizontal mover from above', p.onGround && p.ride === m && Math.abs(p.y - m.y) < 0.6, 'y=' + p.y.toFixed(1));
  const x0 = p.x, m0 = m.x; run(p, L, 2);
  check('is carried along by a horizontal mover', Math.abs((p.x - x0) - (m.x - m0)) < 0.6 && m.x - m0 > 30, 'moved ' + (p.x - x0).toFixed(1) + ' vs platform ' + (m.x - m0).toFixed(1));
  check('stays on it while riding', p.onGround && p.ride === m);
  // jump off
  PH.step(p, { left: false, right: false, jump: true, jumpPressed: true }, 1 / 120, L);
  check('can jump off a mover', !p.onGround && p.ride === null && p.vy < 0);
}
{   // vertical: rides up and down
  const m = mover({ kind: 'v', x: 200, y: 180, min: 120, max: 200, speed: 30, dir: -1 }), L = world([m]), p = PH.newPlayer(232, 100);
  run(p, L, 1); let worst = 0, riding = true;
  for (let i = 0; i < 6 * 120; i++) { PH.step(p, NONE, 1 / 120, L); worst = Math.max(worst, Math.abs(p.y - m.y)); if (!p.onGround || p.ride !== m) riding = false; }
  check('rides a vertical mover up and down without slipping', riding && worst < 0.6, 'worst offset ' + worst.toFixed(2));
}
{   // one-way from below
  const m = mover({ speed: 0 }), L = world([m]), p = PH.newPlayer(232, m.y + 22);
  p.vy = -345; let passed = false, ridingWhileRising = false;
  for (let i = 0; i < 240; i++) { PH.step(p, { left: false, right: false, jump: true, jumpPressed: false }, 1 / 120, L); if (p.vy < 0 && p.ride) ridingWhileRising = true; if (p.y < m.y - 4) passed = true; if (p.onGround) break; }
  check('passes up through a mover from below', passed && !ridingWhileRising);
  check('then lands on top of it', p.onGround && p.ride === m && Math.abs(p.y - m.y) < 0.6, 'y=' + p.y.toFixed(1) + ' mover top=' + m.y);
}
{   // does not carry the player through a wall
  const m = mover({ x: 200, min: 200, max: 330, speed: 40, dir: 1 }), L = world([m], 22), p = PH.newPlayer(232, 120);   // wall column 22 starts at x = 352
  let maxX = 0; for (let i = 0; i < 6 * 120; i++) { PH.step(p, NONE, 1 / 120, L); maxX = Math.max(maxX, p.x); }
  check('a mover carries the player up to a wall but cannot push them into it', maxX > 335 && maxX + 9 <= 22 * T + 0.01, 'max x=' + maxX.toFixed(1));
}
{   // floorBelow sees movers, so the bots and the respawn logic can tell
  const m = mover({}), L = world([m]);
  check('floorBelow counts a mover as floor', PH.floorBelow(L, m.x + 10, m.y - 2, 6) && !PH.floorBelow(L, m.x + m.w + 30, m.y - 2, 6));
}
console.log('problems:', bad); process.exit(bad ? 1 : 0);