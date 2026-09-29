// Math Quest Runner: physics. Pure logic (no DOM) so it also runs in Node for the level tests.
// World units are art pixels: one tile is 16 px. Position (x, y) is the player's feet, centred horizontally.
// Moving platforms live in level.movers: { kind: 'h' | 'v', x, y (top surface), w, min, max, speed, dir, dx, dy }. They are one-way,
// like the floating tile platforms: you land on them from above, and you ride along until you step or jump off.
window.MQR = window.MQR || {};
(function () {
  'use strict';
  const T = 16;
  const P = {
    T,
    W: 18, H: 44,                 // player hitbox
    RUN: 112, ACCEL: 1100, FRICTION: 1300, AIR_ACCEL: 800,
    GRAV: 1050, MAX_FALL: 520,
    JUMP_V: -345, DOUBLE_V: -300, CUT_V: -130,
    COYOTE: 0.09, BUFFER: 0.12,
  };

  function tileAt(level, c, r) {
    if (c < 0 || c >= level.cols) return 1;            // the level edges are walls
    if (r < 0) return 0;
    if (r >= level.rows) return 0;                     // below the map: open air (falling = pit)
    return level.tiles[r * level.cols + c];
  }

  function newPlayer(x, y) {
    return { x, y, vx: 0, vy: 0, onGround: false, facing: 1, coyote: 0, buffer: 0, jumpsUsed: 0, holdingJump: false, canDouble: false, dead: false, t: 0, landed: false, ride: null };
  }

  // Advance every moving platform by dt. Called once per physics step, so platforms freeze whenever the game is paused.
  function updateMovers(level, dt) {
    const ms = level.movers; if (!ms) return;
    for (const m of ms) {
      const px = m.x, py = m.y;
      const k = m.kind === 'h' ? 'x' : 'y';
      m[k] += m.dir * m.speed * dt;
      if (m[k] > m.max) { m[k] = m.max - (m[k] - m.max); m.dir = -1; }
      else if (m[k] < m.min) { m[k] = m.min + (m.min - m[k]); m.dir = 1; }
      m.dx = m.x - px; m.dy = m.y - py;
    }
  }
  // The platform whose top the feet crossed this step (from prevY to y), if any.
  function moverUnder(level, left, right, prevY, y) {
    const ms = level.movers; if (!ms) return null;
    for (const m of ms) if (right > m.x && left < m.x + m.w && prevY <= m.y + 0.5 && y >= m.y - 0.001) return m;
    return null;
  }

  // input: { left, right, jump (held), jumpPressed (edge this frame) }
  function step(p, input, dt, level) {
    p.t += dt;
    updateMovers(level, dt);
    if (p.ride && p.onGround) { moveX(p, p.ride.dx, level); p.y = p.ride.y; }     // carried along by the platform
    else p.ride = null;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = p.onGround ? P.ACCEL : P.AIR_ACCEL;
    if (dir) { p.facing = dir; p.vx += dir * accel * dt; if (Math.abs(p.vx) > P.RUN) p.vx = Math.sign(p.vx) * P.RUN; }
    else { const f = P.FRICTION * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }

    p.coyote = p.onGround ? P.COYOTE : Math.max(0, p.coyote - dt);
    p.buffer = input.jumpPressed ? P.BUFFER : Math.max(0, p.buffer - dt);
    p.landed = false;

    if (p.buffer > 0) {
      if (p.coyote > 0) { p.vy = P.JUMP_V; p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumpsUsed = 1; p.holdingJump = true; p.jumped = 1; }
      else if (p.canDouble && p.jumpsUsed < 2) { p.vy = P.DOUBLE_V; p.buffer = 0; p.jumpsUsed = 2; p.holdingJump = true; p.jumped = 2; }
    }
    if (!input.jump && p.holdingJump && p.vy < P.CUT_V) p.vy = P.CUT_V;     // release early = shorter hop
    if (!input.jump) p.holdingJump = false;

    p.vy = Math.min(P.MAX_FALL, p.vy + P.GRAV * dt);
    moveX(p, p.vx * dt, level);
    moveY(p, p.vy * dt, level);
    if (p.y > level.rows * T + 40) p.dead = true;
  }

  function overlapsSolid(level, left, right, top, bottom) {
    const c0 = Math.floor(left / T), c1 = Math.floor((right - 0.001) / T), r0 = Math.floor(top / T), r1 = Math.floor((bottom - 0.001) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === 1) return { c, r };
    return null;
  }

  function moveX(p, dx, level) {
    if (!dx) return;
    p.x += dx;
    const hit = overlapsSolid(level, p.x - P.W / 2, p.x + P.W / 2, p.y - P.H, p.y);
    if (hit) {
      p.x = dx > 0 ? hit.c * T - P.W / 2 : (hit.c + 1) * T + P.W / 2;
      p.vx = 0;
    }
  }

  function moveY(p, dy, level) {
    const prev = p.y;
    p.onGround = false; p.ride = null;
    p.y += dy;
    const left = p.x - P.W / 2, right = p.x + P.W / 2;
    if (dy >= 0) {
      // Land when the feet cross the top edge of a solid tile, or of a one-way platform, during this step.
      // (Steps are short, so at most one tile row is crossed.)
      const c0 = Math.floor(left / T), c1 = Math.floor((right - 0.001) / T), r = Math.floor(p.y / T);
      for (let c = c0; c <= c1; c++) {
        const t = tileAt(level, c, r);
        if ((t === 1 || t === 2) && prev <= r * T + 0.001 && p.y >= r * T) { land(p, r * T); return; }
      }
      const m = moverUnder(level, left, right, prev, p.y);
      if (m) { land(p, m.y); p.ride = m; return; }
    } else {
      const hit = overlapsSolid(level, left, right, p.y - P.H, p.y - P.H + 1);
      if (hit) { p.y = (hit.r + 1) * T + P.H; p.vy = 0; p.holdingJump = false; }
    }
  }
  function land(p, y) {
    if (!p.onGround && p.vy > 60) p.landed = true;
    p.y = y; p.vy = 0; p.onGround = true; p.jumpsUsed = 0;
  }

  // Is there floor under x within `depth` px below the feet? Used by the level-test bot.
  function floorBelow(level, x, y, depth) {
    const c = Math.floor(x / T);
    for (let r = Math.floor(y / T); r <= Math.floor((y + depth) / T); r++) { const t = tileAt(level, c, r); if (t === 1 || (t === 2 && r * T >= y - 0.5)) return true; }
    for (const m of level.movers || []) if (x >= m.x && x <= m.x + m.w && m.y >= y - 0.5 && m.y <= y + depth) return true;
    return false;
  }

  MQR.Physics = { P, T, tileAt, newPlayer, step, floorBelow, overlapsSolid, updateMovers };
})();