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
{   // crumbling platforms
  const mk = (o) => Object.assign({ kind: 'c', x: 200, y: 160, w: 64, state: 'solid', t: 0, gone: false, dx: 0, dy: 0 }, o);
  const m = mk({}), L = world([m]), p = PH.newPlayer(232, 120);
  run(p, L, 0.3); check('lands on a crumbling platform and it starts to shake', p.onGround && p.ride === m && m.state === 'shaking', 'state ' + m.state);
  run(p, L, PH.CRUMBLE_DELAY - 0.35); check('it holds for the warning time (you can still stand on it)', p.onGround && m.state === 'shaking', 'state ' + m.state + ' t=' + m.t.toFixed(2));
  for (let i = 0; i < 240 && !m.gone; i++) PH.step(p, NONE, 1 / 120, L);
  check('then it drops away and you fall', m.gone && !p.onGround && p.ride === null, 'gone=' + m.gone);
  let landedOn = false; run(p, L, 1); check('you fall to the floor below, not through it', p.onGround && p.ride === null && Math.abs(p.y - 224) < 0.6, 'y=' + p.y.toFixed(1));
  const p2 = PH.newPlayer(232, 120); p2.y = 100; p2.vy = 0;   // a second player passes through the gap while it is gone
  run(p2, L, 0.5); check('a gone platform does not catch anyone', !p2.ride && p2.y > 160, 'y=' + p2.y.toFixed(1));
  run(p, L, PH.CRUMBLE_GONE + 0.2); check('it comes back after a few seconds', m.state === 'solid' && !m.gone, 'state ' + m.state);
  const p3 = PH.newPlayer(232, 100); run(p3, L, 0.6); check('and can be landed on again', p3.ride === m && p3.onGround);
  // jumping off in time saves you
  const m4 = mk({}), L4 = world([m4]), p4 = PH.newPlayer(232, 120); run(p4, L4, 0.3);
  PH.step(p4, { left: false, right: false, jump: true, jumpPressed: true }, 1 / 120, L4); run(p4, L4, 0.3, { left: false, right: false, jump: true, jumpPressed: false });   // jump held: a full jump
  const offEarly = p4.ride === null && m4.state === 'shaking'; run(p4, L4, 1.2);
  check('jumping off during the warning works, and the platform still crumbles', offEarly && m4.state === 'gone', 'state ' + m4.state);
  // coyote time: a jump just after it drops still works
  const m5 = mk({}), L5 = world([m5]), p5 = PH.newPlayer(232, 120); run(p5, L5, 0.3 + PH.CRUMBLE_DELAY - 0.3 + 0.001);
  for (let i = 0; i < 4; i++) PH.step(p5, NONE, 1 / 120, L5);   // now gone
  PH.step(p5, { left: false, right: false, jump: true, jumpPressed: true }, 1 / 120, L5);
  check('a jump right after the drop still works (coyote time)', p5.vy < 0, 'vy=' + p5.vy.toFixed(0));
  check('floorBelow ignores a gone platform', (() => { const mm = mk({ gone: true, state: 'gone' }), LL = world([mm]); return !PH.floorBelow(LL, 230, 158, 6); })());
}console.log('problems:', bad); process.exit(bad ? 1 : 0);