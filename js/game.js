// Math Quest Runner: the game. Canvas rendering, input, questions and screens.
// World units are art pixels (16 px tiles); the view is 480 x 270 units drawn at 2x.
(function () {
  'use strict';
  const Ph = MQR.Physics, P = Ph.P, T = Ph.T;
  const VIEW_W = 480, VIEW_H = 270;
  const PACK = 'assets/opp-jungle/opp1_jungle_tiles/';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------------
  // Save data
  // ------------------------------------------------------------------
  const SAVE_KEY = 'mqr.v1';
  const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })();
  save.best = save.best || {};                   // best['g3'] = [ {stars, acc, time} x3 ]
  save.runs = Array.isArray(save.runs) ? save.runs : [];
  save.settings = Object.assign({ sound: true, music: true }, save.settings || {});
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

  // ------------------------------------------------------------------
  // Sound (Web Audio, created on the first user gesture)
  // ------------------------------------------------------------------
  const Sound = {
    ac: null,
    unlock() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } } if (this.ac.state === 'suspended') this.ac.resume(); },
    tone(f, dur, type, vol, f2, delay) {
      if (!save.settings.sound || !this.ac) return;
      const t = this.ac.currentTime + (delay || 0), o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ac.destination); o.start(t); o.stop(t + dur + 0.02);
    },
  };
  const sfx = {
    jump: () => Sound.tone(340, 0.12, 'square', 0.03, 640),
    double: () => Sound.tone(520, 0.12, 'square', 0.03, 900),
    coin: () => [988, 1319].forEach((f, i) => Sound.tone(f, 0.1, 'square', 0.04, null, i * 0.07)),
    stomp: () => Sound.tone(200, 0.15, 'square', 0.06, 70),
    right: () => [660, 880, 1175].forEach((f, i) => Sound.tone(f, 0.1, 'triangle', 0.06, null, i * 0.07)),
    wrong: () => Sound.tone(170, 0.3, 'sawtooth', 0.05, 90),
    hurt: () => Sound.tone(300, 0.25, 'square', 0.05, 80),
    splash: () => Sound.tone(500, 0.3, 'triangle', 0.06, 90),
    open: () => Sound.tone(600, 0.08, 'triangle', 0.04, 900),
    clear: () => [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.tone(f, 0.14, 'square', 0.05, null, i * 0.09)),
    over: () => [392, 330, 262, 196].forEach((f, i) => Sound.tone(f, 0.25, 'triangle', 0.06, null, i * 0.2)),
    rumble: () => Sound.tone(90, 0.2, 'square', 0.03, 65),
    crumble: () => Sound.tone(120, 0.3, 'sawtooth', 0.05, 45),
    unlock: () => [523, 784, 1047].forEach((f, i) => Sound.tone(f, 0.1, 'square', 0.04, null, i * 0.08)),
  };

  // ------------------------------------------------------------------
  // Music: one original tune per level theme (js/music.js), scheduled a little ahead on the audio clock.
  // Plays while you run, ducks under a question, and stops on pause, menus and level end.
  // ------------------------------------------------------------------
  const MusicPlayer = {
    run: null, duck: false, bus: null,
    getBus() { const ac = Sound.ac; if (!this.bus || this.bus.context !== ac) { this.bus = ac.createGain(); this.bus.gain.value = 0.5; this.bus.connect(ac.destination); } return this.bus; },
    start(theme) {
      if (!save.settings.music || !Sound.ac || !MQR.Music) return;
      this.stop();
      const ac = Sound.ac, gain = ac.createGain(); gain.gain.value = this.duck ? 0.35 : 1; gain.connect(this.getBus());
      this.run = { theme, gain, bar: 0, next: ac.currentTime + 0.08, timer: setInterval(() => this.tick(), 60) };
      this.tick();
    },
    tick() {
      const r = this.run; if (!r) return; const ac = Sound.ac;
      while (r.next < ac.currentTime + 0.5) { MQR.Music.schedule(ac, r.gain, r.theme, r.bar, r.next); r.next += MQR.Music.barSeconds(r.theme); r.bar++; }
    },
    stop() {
      const r = this.run; if (!r) return; clearInterval(r.timer); this.run = null;
      const now = Sound.ac.currentTime; r.gain.gain.cancelScheduledValues(now); r.gain.gain.setTargetAtTime(0, now, 0.05);
      setTimeout(() => { try { r.gain.disconnect(); } catch (e) { /* already gone */ } }, 600);
    },
    setDuck(d) { this.duck = d; if (this.run) this.run.gain.gain.setTargetAtTime(d ? 0.35 : 1, Sound.ac.currentTime, 0.08); },
  };
  function syncMusic() {
    const want = save.settings.music && G && G.level && (G.state === 'play' || G.state === 'question');
    if (!want) { MusicPlayer.stop(); return; }
    if (!MusicPlayer.run || MusicPlayer.run.theme !== G.level.theme) MusicPlayer.start(G.level.theme);
    MusicPlayer.setDuck(G.state === 'question');
  }
  setInterval(syncMusic, 1000);   // also catches the case where the audio context was not unlocked yet

  // ------------------------------------------------------------------
  // Images
  // ------------------------------------------------------------------
  const IMG = {};
  const FILES = {
    ground: 'environment/tiles/jungle/tile_jungle_ground_brown.png',
    bottom: 'environment/tiles/jungle/tile_jungle_bottom_brown.png',
    temple: 'environment/tiles/temple/tile_temple.png',
    water: 'environment/tiles/jungle/tile_jungle_water.png',
    treeLight: 'environment/tiles/jungle/tile_jungle_tree_light.png',
    treeDark: 'environment/tiles/jungle/tile_jungle_tree_dark.png',
    vines: 'environment/tiles/jungle/tile_jungle_bg_vines.png',
    veg: 'environment/tiles/jungle/tile_jungle_vegetation.png',
    cloud1: 'environment/background/bg objects/bg_cloud01.png',
    cloud2: 'environment/background/bg objects/bg_cloud2.png',
    cloud3: 'environment/background/bg objects/bg_cloud3.png',
    cloud5: 'environment/background/bg objects/bg_cloud5.png',
    cloud6: 'environment/background/bg objects/bg_cloud6.png',
    carni: 'environment/objects/obj_carniplant.png',
  };
  function loadImage(key, src) {
    return new Promise((resolve) => { const im = new Image(); im.onload = () => { IMG[key] = im; resolve(); }; im.onerror = () => { console.warn('missing image', src); resolve(); }; im.src = encodeURI(src); });
  }
  function loadAll() {
    const jobs = Object.entries(FILES).map(([k, f]) => loadImage(k, PACK + f));
    Object.entries(MQR.SPRITES).forEach(([k, s]) => jobs.push(loadImage('spr_' + k, s.file)));
    return Promise.all(jobs);
  }
  function frameAt(name, t) {
    const s = MQR.SPRITES[name]; if (!s) return 0;
    const total = s.ms.reduce((a, b) => a + b, 0); let m = (t * 1000) % total, i = 0;
    while (i < s.ms.length - 1 && m >= s.ms[i]) { m -= s.ms[i]; i++; }
    return i;
  }
  // Draw frame `f` of a sprite strip with its feet at (x, y). Sprites are 64 x 64 frames.
  function drawSprite(name, f, x, y, flip, alpha, sx, sy) {
    const im = IMG['spr_' + name], s = MQR.SPRITES[name]; if (!im || !s) return;
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
    ctx.drawImage(im, f * s.w, 0, s.w, s.h, -s.w / 2, -s.h, s.w, s.h);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  const keys = { left: false, right: false, jump: false };
  let jumpEdge = false;
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
  function setKey(k, down) { if (k === 'jump' && down && !keys.jump) jumpEdge = true; keys[k] = down; }
  document.addEventListener('keydown', (e) => {
    Sound.unlock();
    if (G && G.state === 'question') {
      if (/^[1-4]$/.test(e.key)) { e.preventDefault(); answer(Number(e.key) - 1); }
      else if ((e.key === 'Enter' || e.key === ' ') && G.q && G.q.needAck) { e.preventDefault(); closeQuestion(); }
      else if (e.key === 'Escape') { e.preventDefault(); }
      return;
    }
    const k = KEYMAP[e.code];
    if (k && G && (G.state === 'play')) { e.preventDefault(); if (!e.repeat) setKey(k, true); return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (G && G.state === 'play') { e.preventDefault(); pause(); }
      else if (G && G.state === 'pause') { e.preventDefault(); resume(); }
    }
  });
  document.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) setKey(k, false); });
  function releaseKeys() { keys.left = keys.right = keys.jump = false; jumpEdge = false; document.querySelectorAll('.touch button').forEach((b) => b.classList.remove('on')); }
  document.querySelectorAll('.touch button').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); b.classList.add('on'); setKey(k, true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => { b.classList.remove('on'); setKey(k, false); }));
  });
  window.addEventListener('blur', () => { releaseKeys(); if (G && G.state === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.state === 'play') pause(); });

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  const LEVELS = MQR.Levels.CONFIGS;
  let G = { state: 'menu', grade: 1, levelIndex: 0, t: 0 };
  const SCREENS = ['scrMenu', 'scrIntro', 'scrQuestion', 'scrPause', 'scrDone', 'scrOver'];
  function showScreen(id) {
    SCREENS.forEach((s) => $(s).classList.toggle('show', s === id));
    const canPause = G.state === 'play' || G.state === 'pause' || G.state === 'question';
    $('btnPause').disabled = !(G.state === 'play' || G.state === 'pause');
    $('btnPause').textContent = G.state === 'pause' ? 'Resume' : 'Pause';
    $('touch').classList.toggle('active', G.state === 'play' || G.state === 'question' || G.state === 'pause');
    if (id) { const p = $(id).querySelector('[data-primary]:not([disabled])'); if (p) setTimeout(() => p.focus({ preventScroll: true }), 30); }
    void canPause;
    syncMusic();
  }
  const starsHtml = (n, of) => { let s = ''; for (let i = 0; i < (of || 3); i++) s += i < n ? '&#9733;' : '<i>&#9733;</i>'; return s; };
  const gradeBest = (g) => (save.best['g' + g] || []).reduce((n, r) => n + (r ? r.stars : 0), 0);

  function showMenu() {
    G = { state: 'menu', grade: G.grade || 1, levelIndex: 0, t: G.t || 0, menu: true };
    releaseKeys();
    const grid = $('gradeGrid'); grid.innerHTML = '';
    MQR.Math.GRADES.forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'grade';
      b.innerHTML = '<b>' + g + '</b><span>' + MQR.Math.TOPICS[g] + '</span><div class="stars">&#9733; ' + gradeBest(g) + '/9</div>';
      if (g === 1) b.dataset.primary = '';
      b.addEventListener('click', () => { Sound.unlock(); startRun(g); });
      grid.appendChild(b);
    });
    showScreen('scrMenu');
  }

  function startRun(grade) {
    G = { state: 'intro', grade, levelIndex: 0, t: 0, results: [], runStart: Date.now() };
    startLevel(0);
  }

  function startLevel(i) {
    const level = MQR.Levels.build(LEVELS[i]);
    const g = G;
    Object.assign(g, {
      state: 'intro', levelIndex: i, level, p: Ph.newPlayer(level.start.x, level.start.y), halves: 6, coins: 0, stomps: 0, asked: 0, right: 0, wrong: 0,
      time: 0, camX: 0, safe: { x: level.start.x, y: level.start.y }, inv: 0, flagToast: 0, particles: [], toasts: [], q: null, splashed: false, crumbleSeen: false, doubleUnlocked: i > 0,
    });
    g.p.canDouble = i > 0;
    g.layer = paintLevel(level);
    releaseKeys();
    $('inGrade').textContent = 'Grade ' + g.grade + ' \u00b7 ' + MQR.Math.TOPICS[g.grade] + ' \u00b7 Level ' + (i + 1) + ' of 3';
    $('inName').textContent = level.name;
    $('inHint').textContent = level.hint;
    $('inGoal').textContent = 'Reach the flag with at least ' + level.requirement.coins + ' of 10 star coins and ' + level.requirement.stomps + ' of 8 gremlins.' + (i === 0 ? ' A double-jump waits for you a little way in.' : '');
    showScreen('scrIntro');
  }

  function begin() { if (G.state !== 'intro') return; G.state = 'play'; showScreen(null); }
  function pause() { if (G.state !== 'play') return; G.state = 'pause'; releaseKeys(); showScreen('scrPause'); }
  function resume() { if (G.state !== 'pause') return; G.state = 'play'; showScreen(null); }

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------
  function burst(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(30, spread || 110); G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rnd(0.4, 0.8), max: 0.8, color, r: rnd(1, 2.6) }); }
  }
  function toast(text, color) { G.toasts.push({ text, color: color || '#fff', t: 1.8 }); if (G.toasts.length > 3) G.toasts.shift(); }
  function floatText(x, y, text, color) { G.particles.push({ x, y, vx: 0, vy: -26, life: 1.1, max: 1.1, text, color: color || '#fff' }); }

  // ------------------------------------------------------------------
  // Questions
  // ------------------------------------------------------------------
  const answerButtons = [...document.querySelectorAll('.ans')];
  function engage(kind, item, stomp) {
    const data = MQR.Math.make(G.grade, G.levelIndex + 1);
    G.q = { kind, item, stomp, data, answered: false, closeT: 0 };
    G.state = 'question'; releaseKeys(); sfx.open();
    $('qKind').textContent = kind === 'coin' ? 'Star coin! Solve it to collect' : 'Gremlin! Solve it to stomp';
    const qt = $('qText'); qt.textContent = data.text; qt.classList.toggle('long', data.text.length > 26);
    answerButtons.forEach((b, i) => { b.disabled = false; b.className = 'ans'; b.innerHTML = '<small>' + (i + 1) + '</small>' + data.choices[i]; });
    $('qFeedback').textContent = ''; $('qFeedback').className = 'feedback';
    $('qHow').classList.add('hidden'); $('btnGotIt').classList.add('hidden');
    showScreen('scrQuestion');
  }
  function answer(i) {
    const q = G && G.q;
    if (!q || q.answered || G.state !== 'question') return;
    q.answered = true; G.asked++;
    const ok = i === q.data.answer;
    answerButtons.forEach((b, j) => { b.disabled = true; if (j === q.data.answer) b.classList.add('ok'); else if (j === i) b.classList.add('bad'); });
    const p = G.p, it = q.item;
    if (ok) {
      G.right++; sfx.right();
      $('qFeedback').textContent = (q.data.explain || 'Correct!') + '  Great!'; $('qFeedback').className = 'feedback good';
      q.closeT = 1.0;
      if (q.kind === 'coin') { it.taken = true; G.coins++; sfx.coin(); burst(it.x, it.y, '#ffd54f', 16); floatText(it.x, it.y - 8, '+1', '#ffd54f'); }
      else { it.alive = false; it.deadT = 0.5; G.stomps++; sfx.stomp(); burst(it.x, it.y - 8, '#9be37a', 14); floatText(it.x, it.y - 20, 'Stomp!', '#9be37a'); if (q.stomp) { p.vy = -260; p.onGround = false; p.jumpsUsed = 1; } else { p.vx = -p.facing * 60; } }
    } else {
      G.wrong++; G.halves = Math.max(0, G.halves - 1); sfx.wrong();
      const picked = q.data.choices[i];
      $('qFeedback').textContent = 'Not quite. ' + ((q.data.why && q.data.why[picked]) || '') + ' You can try again later.'; $('qFeedback').className = 'feedback bad';
      $('qHow').textContent = 'How to work it out: ' + (q.data.how || q.data.explain); $('qHow').classList.remove('hidden');   // stays until the player taps Got it, so there is time to read
      q.needAck = true; q.closeT = Infinity; G.inv = 1.8;
      $('btnGotIt').classList.remove('hidden'); setTimeout(() => $('btnGotIt').focus({ preventScroll: true }), 30);
      if (q.kind === 'coin') it.cool = 3; else { it.flee = 1.6; it.fleeDir = it.x >= p.x ? 1 : -1; }
      p.vy = -170; p.vx = -p.facing * 90;
      burst(p.x, p.y - 20, '#ff8a8a', 8, 70);
    }
  }
  answerButtons.forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.i))));
  $('btnGotIt').addEventListener('click', closeQuestion);
  function closeQuestion() {
    if (!G.q) return;
    G.q = null;
    if (G.halves <= 0) return gameOver();
    G.state = 'play'; showScreen(null);
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  function update(dt) {
    G.t += dt;
    if (G.state === 'question') { if (G.q && G.q.answered) { G.q.closeT -= dt; if (G.q.closeT <= 0) closeQuestion(); } updateEffects(dt); return; }
    if (G.state !== 'play') { updateEffects(dt); return; }
    const L = G.level, p = G.p;
    G.time += dt; G.inv = Math.max(0, G.inv - dt); G.flagToast = Math.max(0, G.flagToast - dt);

    // Double-jump lesson in level 1: unlocked a little way in, with a note.
    if (!G.doubleUnlocked && p.x > 26 * T) { G.doubleUnlocked = true; p.canDouble = true; toast('Double jump unlocked! Press jump again in the air.', '#ffd54f'); sfx.unlock(); }

    const input = { left: keys.left, right: keys.right, jump: keys.jump, jumpPressed: jumpEdge };
    jumpEdge = false;
    const steps = 2;
    p.jumped = 0;
    for (let i = 0; i < steps; i++) { Ph.step(p, { left: input.left, right: input.right, jump: input.jump, jumpPressed: i === 0 && input.jumpPressed }, dt / steps, L); if (p.jumped) break; }
    if (p.jumped) { p.jumped === 2 ? sfx.double() : sfx.jump(); }
    p.x = clamp(p.x, P.W / 2, L.width - P.W / 2);
    if (p.landed && p.vy === 0) burst(p.x, p.y, '#d9c79a', 3, 40);
    (L.movers || []).forEach((m) => {                      // crumbling platforms: sound, dust and a one-time tip when one starts to go
      if (m.kind !== 'c' || m.state === m.vis) return;
      if (m.state === 'shaking') { sfx.rumble(); if (!G.crumbleSeen) { G.crumbleSeen = true; toast('This platform crumbles! Keep moving.', '#ffd54f'); } }
      else if (m.state === 'gone') { sfx.crumble(); burst(m.x + m.w / 2, m.y + 4, '#c9b48a', 12, 60); }
      m.vis = m.state;
    });

    // Remember the last safe spot on solid ground (both sides supported) for respawning after a fall.
    if (p.onGround && !p.ride && Ph.floorBelow(L, p.x - 20, p.y, 4) && Ph.floorBelow(L, p.x + 20, p.y, 4)) { G.safe.x = p.x; G.safe.y = p.y; }
    const waterY = L.theme === 'river' ? 15 * T : Infinity;
    if (p.dead || p.y > waterY + 6) { fell(); return; }

    // Gremlins patrol.
    L.gremlins.forEach((g) => {
      if (!g.alive) { g.deadT = Math.max(0, (g.deadT || 0) - dt); return; }
      g.cool = Math.max(0, (g.cool || 0) - dt);
      if (g.flee > 0) { g.flee -= dt; g.x += g.fleeDir * g.speed * 2.6 * dt; g.dir = g.fleeDir; }
      else g.x += g.dir * g.speed * dt;
      if (g.x < g.left) { g.x = g.left; g.dir = 1; if (g.flee > 0) g.fleeDir = 1; }
      if (g.x > g.right) { g.x = g.right; g.dir = -1; if (g.flee > 0) g.fleeDir = -1; }
    });
    L.coins.forEach((c) => { c.cool = Math.max(0, (c.cool || 0) - dt); });

    // Engage star coins and gremlins by touching them.
    if (G.inv <= 0) {
      const px0 = p.x - P.W / 2, px1 = p.x + P.W / 2, py0 = p.y - P.H, py1 = p.y;
      for (const c of L.coins) {
        if (c.taken || c.cool > 0) continue;
        if (c.x + 7 > px0 && c.x - 7 < px1 && c.y + 7 > py0 && c.y - 7 < py1) { engage('coin', c, false); return; }
      }
      for (const g of L.gremlins) {
        if (!g.alive || g.flee > 0) continue;
        if (g.x + 11 > px0 && g.x - 11 < px1 && g.y + 1 > py0 && g.y - 17 < py1) { engage('gremlin', g, p.vy > 30 && p.y - 6 <= g.y - 10); return; }
      }
    }

    // The flag.
    if (Math.abs(p.x - L.flag.x) < 12 && p.y > L.flag.y - 60) {
      if (G.coins >= L.requirement.coins && G.stomps >= L.requirement.stomps) return finishLevel();
      if (G.flagToast <= 0) { G.flagToast = 3; toast('Need ' + L.requirement.coins + ' star coins (you have ' + G.coins + ') and ' + L.requirement.stomps + ' gremlins (you have ' + G.stomps + ').', '#ffb74d'); }
    }
    G.camX += (clamp(p.x - VIEW_W * 0.42 + p.vx * 0.3, 0, L.width - VIEW_W) - G.camX) * Math.min(1, dt * 7);
    updateEffects(dt);
  }
  function updateEffects(dt) {
    if (!G.particles) return;
    G.particles.forEach((q) => { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (!q.text) q.vy += 260 * dt; });
    G.particles = G.particles.filter((q) => q.life > 0);
    G.toasts.forEach((t) => { t.t -= dt; }); G.toasts = G.toasts.filter((t) => t.t > 0);
  }

  function fell() {
    const p = G.p, L = G.level;
    sfx.splash(); burst(p.x, Math.min(p.y, L.height - 30), L.theme === 'river' ? '#8fd3ff' : '#c9b48a', 14);
    G.halves = Math.max(0, G.halves - 1);
    if (G.halves <= 0) return gameOver();
    toast(L.theme === 'river' ? 'Splash! Lost half a heart.' : 'Oops! Lost half a heart.', '#ff9a9a');
    Object.assign(p, { x: G.safe.x, y: G.safe.y, vx: 0, vy: 0, dead: false, onGround: true, jumpsUsed: 0, ride: null }); G.inv = 1.4;
  }

  function gameOver() { G.state = 'over'; releaseKeys(); sfx.over(); showScreen('scrOver'); }

  function finishLevel() {
    const acc = G.asked ? G.right / G.asked : 1;
    const stars = 1 + (acc >= 0.85 ? 1 : 0) + (acc >= 0.85 && G.coins === 10 && G.stomps === 8 ? 1 : 0);
    const res = { stars, acc: Math.round(acc * 100), time: Math.round(G.time), coins: G.coins, stomps: G.stomps, asked: G.asked, right: G.right };
    G.results[G.levelIndex] = res;
    const key = 'g' + G.grade; const prev = (save.best[key] = save.best[key] || [])[G.levelIndex];
    if (!prev || stars > prev.stars || (stars === prev.stars && res.time < prev.time)) save.best[key][G.levelIndex] = res;
    const last = G.levelIndex === LEVELS.length - 1;
    if (last) {
      const total = G.results.reduce((n, r) => n + r.stars, 0), asked = G.results.reduce((n, r) => n + r.asked, 0), right = G.results.reduce((n, r) => n + r.right, 0), time = G.results.reduce((n, r) => n + r.time, 0);
      save.runs.push({ grade: G.grade, stars: total, acc: asked ? Math.round((right / asked) * 100) : 100, time, at: Date.now() });
      save.runs.sort((a, b) => b.stars - a.stars || a.time - b.time); save.runs = save.runs.slice(0, 20);
    }
    persist(); G.state = 'done'; releaseKeys(); sfx.clear(); showDone(res, last);
  }

  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function showDone(res, last) {
    $('doneKicker').textContent = 'Grade ' + G.grade + ' \u00b7 ' + G.level.name;
    $('doneTitle').textContent = last ? 'You finished all three levels!' : 'Level clear!';
    $('doneStars').innerHTML = starsHtml(res.stars);
    if (last) {
      const rs = G.results, total = rs.reduce((n, r) => n + r.stars, 0), asked = rs.reduce((n, r) => n + r.asked, 0), right = rs.reduce((n, r) => n + r.right, 0), time = rs.reduce((n, r) => n + r.time, 0);
      $('doneStats').innerHTML = '<div><b>' + total + '/9</b>stars</div><div><b>' + (asked ? Math.round((right / asked) * 100) : 100) + '%</b>correct</div><div><b>' + right + '/' + asked + '</b>problems</div><div><b>' + fmtTime(time) + '</b>total time</div>';
      $('doneHint').textContent = 'Your best runs are saved on this device. Try another grade, or go for 9 stars.';
    } else {
      $('doneStats').innerHTML = '<div><b>' + res.coins + '/10</b>star coins</div><div><b>' + res.stomps + '/8</b>gremlins</div><div><b>' + res.acc + '%</b>correct</div><div><b>' + fmtTime(res.time) + '</b>time</div>';
      $('doneHint').textContent = res.stars < 3 ? 'For 3 stars: 85% correct and every coin and gremlin.' : 'Perfect run!';
    }
    $('btnNext').classList.toggle('hidden', last);
    showScreen('scrDone');
  }

  // ------------------------------------------------------------------
  // Level art: the tile layer is painted once per level into an offscreen canvas
  // ------------------------------------------------------------------
  function paintLevel(L) {
    const layer = document.createElement('canvas'); layer.width = L.width; layer.height = L.height;
    const o = layer.getContext('2d'); o.imageSmoothingEnabled = false;
    const G_ = IMG.ground, B = IMG.bottom, TP = IMG.temple;
    const solid = (c, r) => (c < 0 || c >= L.cols ? true : r < 0 ? false : r >= L.rows ? true : L.tiles[r * L.cols + c] === 1);
    const one = (c, r) => c >= 0 && c < L.cols && r >= 0 && r < L.rows && L.tiles[r * L.cols + c] === 2;
    const cell = (img, cx, cy, dx, dy) => { if (img) o.drawImage(img, cx * 16, cy * 16, 16, 16, dx, dy, 16, 16); };
    const painted = new Uint8Array(L.cols * L.rows);
    const ruins = L.theme === 'ruins';
    for (let c = 0; c < L.cols; c++) {
      for (let r = 0; r < L.rows; r++) {
        const t = L.tiles[r * L.cols + c], x = c * 16, y = r * 16;
        if (t === 1) {
          const leftOpen = !solid(c - 1, r) && c > 0, rightOpen = !solid(c + 1, r) && c < L.cols - 1;
          if (!solid(c, r - 1)) {                                            // walkable surface
            if (ruins) {
              const sx = leftOpen ? 0 : rightOpen ? 7 : 1 + ((c * 3 + r) % 6);
              cell(TP, sx, 1, x, y - 16); cell(TP, sx, 2, x, y);
              if (solid(c, r + 1)) { cell(TP, sx, 3, x, y + 16); painted[(r + 1) * L.cols + c] = 1; }
            } else {
              const sx = leftOpen ? 0 : rightOpen ? 5 : 1 + ((c * 5 + r) % 4);
              cell(G_, sx, 1, x, y - 16); cell(G_, sx, 2, x, y);
              if (solid(c, r + 1)) { cell(G_, sx, 3, x, y + 16); painted[(r + 1) * L.cols + c] = 1; }
            }
          } else if (!painted[r * L.cols + c]) {                             // fill below the surface
            if (ruins) {
              const sx = leftOpen ? 0 : rightOpen ? 7 : 1 + ((c * 3 + r) % 6);
              cell(TP, sx, 3 + ((r + c) % 3), x, y);
            } else {
              const h = (c * 7 + r * 13) % 11;
              if (leftOpen) cell(G_, 0, 3, x, y); else if (rightOpen) cell(G_, 5, 3, x, y);
              else if (h === 0) cell(B, 1 + ((c + r) % 4), 1, x, y); else cell(G_, 1 + ((c + r) % 4), 3, x, y);
            }
          }
        } else if (t === 2) {                                                // one-way platform
          const lft = !one(c - 1, r), rgt = !one(c + 1, r);
          if (ruins) {
            const sx = lft ? 0 : rgt ? 7 : 1 + (c % 6);
            cell(TP, sx, 1, x, y - 16); cell(TP, sx, 2, x, y);
          } else {
            const sx = lft ? 0 : rgt ? 5 : 1 + (c % 4);
            cell(G_, sx, 5, x, y - 16); cell(G_, sx, 6, x, y); cell(G_, sx, 7, x, y + 16);
          }
        }
      }
    }
    return layer;
  }

  // ------------------------------------------------------------------
  // Backgrounds (parallax)
  // ------------------------------------------------------------------
  function gradient(stops) { const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); stops.forEach(([p, c]) => g.addColorStop(p, c)); return g; }
  function tileImage(img, cam, par, y, gap, alpha, scale) {
    if (!img) return; const w = img.width * (scale || 1) + gap, off = -((cam * par) % w);
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (let x = off - w; x < VIEW_W + w; x += w) ctx.drawImage(img, Math.round(x), Math.round(y), img.width * (scale || 1), img.height * (scale || 1));
    ctx.restore();
  }
  function hills(cam, par, base, amp, wave, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 8) ctx.lineTo(x, base + Math.sin((x + cam * par) / wave) * amp + Math.sin((x + cam * par) / (wave * 0.37)) * amp * 0.35);
    ctx.lineTo(VIEW_W, VIEW_H); ctx.fill();
  }
  function columns(cam, par, w, gap, top, color, seed) {
    ctx.fillStyle = color; const tot = w + gap, off = -((cam * par) % tot);
    for (let x = off - tot, i = Math.floor((cam * par) / tot) - 1; x < VIEW_W + tot; x += tot, i++) {
      const h = 90 + ((i * 37 + seed) % 5) * 22, broken = ((i * 11 + seed) % 4) === 0;
      ctx.fillRect(Math.round(x), top + (broken ? 24 : 0), w, VIEW_H); ctx.fillRect(Math.round(x) - 3, top + (broken ? 24 : 0), w + 6, 6);
      void h;
    }
  }
  function drawBackground(theme, cam, t) {
    if (theme === 'ruins') {
      ctx.fillStyle = gradient([[0, '#f6d58e'], [0.55, '#eeb46b'], [1, '#b96f3a']]); ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const rg = ctx.createRadialGradient(VIEW_W * 0.7, 40, 6, VIEW_W * 0.7, 40, 190); rg.addColorStop(0, 'rgba(255,248,210,.85)'); rg.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.save(); ctx.fillStyle = 'rgba(255,240,180,.10)';
      for (let i = 0; i < 4; i++) { const x = ((i * 150 - cam * 0.25) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x - 60, VIEW_H); ctx.lineTo(x - 130, VIEW_H); ctx.fill(); }
      ctx.restore();
      columns(cam, 0.22, 26, 74, 70, 'rgba(120,84,40,.30)', 3);
      columns(cam, 0.42, 34, 96, 46, 'rgba(84,66,32,.45)', 8);
      tileImage(IMG.vines, cam, 0.6, -230, 260, 0.55);
    } else if (theme === 'river') {
      ctx.fillStyle = gradient([[0, '#0b2f3a'], [0.5, '#2a7a78'], [1, '#8fd0b8']]); ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const mg = ctx.createRadialGradient(VIEW_W * 0.3, 50, 4, VIEW_W * 0.3, 50, 120); mg.addColorStop(0, 'rgba(230,250,240,.55)'); mg.addColorStop(1, 'rgba(230,250,240,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      tileImage(IMG.treeDark, cam, 0.30, -150, 240, 0.35);
      tileImage(IMG.treeDark, cam, 0.5, -175, 330, 0.55);
      ctx.fillStyle = 'rgba(200,240,225,.13)'; for (let i = 0; i < 3; i++) { const y = 120 + i * 34 + Math.sin(t * 0.4 + i) * 4; ctx.fillRect(0, y, VIEW_W, 22); }
      for (let i = 0; i < 26; i++) { const fx = (i * 97 + Math.sin(t * 0.6 + i) * 20 + 500 - cam * 0.2 * ((i % 3) + 1) * 0.5) % VIEW_W, fy = 60 + (i * 53) % 160 + Math.sin(t + i * 2) * 6, a = 0.35 + 0.35 * Math.sin(t * 2 + i); ctx.fillStyle = 'rgba(255,245,160,' + a.toFixed(2) + ')'; ctx.fillRect(((fx % VIEW_W) + VIEW_W) % VIEW_W, fy, 2, 2); }
    } else {
      ctx.fillStyle = gradient([[0, '#67bfee'], [0.6, '#b8e6f7'], [1, '#e8f7e6']]); ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      tileImage(IMG.cloud1, cam, 0.10, 14, 380, 0.95); tileImage(IMG.cloud5, cam, 0.16, 60, 290, 0.9); tileImage(IMG.cloud2, cam, 0.07, 100, 470, 0.7); tileImage(IMG.cloud3, cam, 0.2, 30, 210, 0.85);
      hills(cam, 0.2, 176, 14, 90, '#8fd19e'); hills(cam, 0.34, 198, 12, 70, '#5fb57b');
      tileImage(IMG.treeLight, cam, 0.5, -132, 280, 0.8);
    }
  }

  // ------------------------------------------------------------------
  // Entities
  // ------------------------------------------------------------------
  function drawCoin(c, t) {
    const sx = Math.max(0.15, Math.abs(Math.cos(t * 3 + c.id))), y = c.y + Math.sin(t * 2.5 + c.id) * 1.6;
    ctx.save(); ctx.translate(Math.round(c.x), Math.round(y));
    ctx.globalAlpha = c.cool > 0 ? 0.35 : 1;
    ctx.fillStyle = 'rgba(255,240,150,.22)'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.scale(sx, 1);
    ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(0, 0, 6.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.1 : 4.6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function questionBubble(x, y, t) {
    const b = Math.sin(t * 3 + x) * 1.2; ctx.save(); ctx.translate(Math.round(x), Math.round(y + b));
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#245b3a'; ctx.font = 'bold 8px Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0.5); ctx.restore();
  }
  function drawGremlin(g, theme, t) {
    const name = theme === 'ruins' ? 'frog_red' : theme === 'river' ? 'frog_blue' : 'frog_green';
    if (!g.alive) { if (g.deadT > 0) drawSprite(name, 0, g.x, g.y, g.dir < 0, g.deadT * 2, 1.15, 0.35); return; }
    const hop = g.flee > 0 ? -Math.abs(Math.sin(t * 14 + g.id)) * 4 : -Math.abs(Math.sin(t * 5 + g.id)) * 2.2;
    drawSprite(name, frameAt(name, t + g.id * 0.37), g.x, g.y + hop, g.dir > 0, 1);
    if (!(g.flee > 0)) questionBubble(g.x, g.y - 28 + hop, t);
  }
  // A crumbling platform: cracked, shakes during its warning, and leaves a faint outline while it is gone.
  function drawCrumble(m, ruins, t, cell) {
    const G_ = IMG.ground, TP = IMG.temple, n = Math.round(m.w / 16), y = Math.round(m.y);
    let x0 = Math.round(m.x);
    if (m.gone) {
      const back = m.t < 0.6 ? 0.25 + 0.25 * Math.sin(t * 24) : 0.14;       // blinks just before it returns
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + back.toFixed(2) + ')'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, m.w - 1, 9); ctx.restore();
      return;
    }
    if (m.state === 'shaking') x0 += Math.round(Math.sin(t * 90) * 1.4);
    const dy = m.state === 'shaking' ? Math.round(Math.sin(t * 70 + 1) * 0.8) : 0;
    for (let i = 0; i < n; i++) {
      const sx = i === 0 ? 0 : i === n - 1 ? (ruins ? 7 : 5) : (ruins ? 1 + (i % 6) : 1 + (i % 4)), x = x0 + i * 16;
      if (ruins) { cell(TP, sx, 1, x, y - 16 + dy); cell(TP, sx, 2, x, y + dy); }
      else { cell(G_, sx, 5, x, y - 16 + dy); cell(G_, sx, 6, x, y + dy); cell(G_, sx, 7, x, y + 16 + dy); }
    }
    ctx.save(); ctx.fillStyle = 'rgba(214,120,40,' + (m.state === 'shaking' ? 0.34 : 0.22) + ')'; ctx.fillRect(x0, y - 2 + dy, m.w, 14);   // warm tint marks the crumbling kind
    ctx.strokeStyle = 'rgba(30,12,4,0.95)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < n; i++) { const cx = x0 + i * 16 + 8; ctx.moveTo(cx - 5, y + 1 + dy); ctx.lineTo(cx - 1, y + 6 + dy); ctx.lineTo(cx - 4, y + 11 + dy); ctx.moveTo(cx + 3, y + 3 + dy); ctx.lineTo(cx + 6, y + 8 + dy); }
    ctx.stroke(); ctx.strokeStyle = 'rgba(255,236,190,0.55)'; ctx.lineWidth = 0.8; ctx.translate(1.2, 0); ctx.stroke(); ctx.restore();
  }
  function drawMovers(L, theme, t) {
    const ruins = theme === 'ruins', G_ = IMG.ground, TP = IMG.temple;
    const cell = (img, cx, cy, dx, dy) => { if (img) ctx.drawImage(img, cx * 16, cy * 16, 16, 16, dx, dy, 16, 16); };
    (L.movers || []).forEach((m) => {
      if (m.kind === 'c') { drawCrumble(m, ruins, t, cell); return; }
      const n = Math.round(m.w / 16), x0 = Math.round(m.x), y = Math.round(m.y);
      for (let i = 0; i < n; i++) {
        const sx = i === 0 ? 0 : i === n - 1 ? (ruins ? 7 : 5) : (ruins ? 1 + (i % 6) : 1 + (i % 4)), x = x0 + i * 16;
        if (ruins) { cell(TP, sx, 1, x, y - 16); cell(TP, sx, 2, x, y); }
        else { cell(G_, sx, 5, x, y - 16); cell(G_, sx, 6, x, y); cell(G_, sx, 7, x, y + 16); }
      }
      // little arrows on the underside show which way it moves
      const cx = x0 + m.w / 2, cy = y + 7, a = 0.45 + 0.2 * Math.sin(t * 4 + m.id);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.beginPath();
      if (m.kind === 'h') { ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 4, cy - 3); ctx.lineTo(cx - 4, cy + 3); ctx.moveTo(cx + 9, cy); ctx.lineTo(cx + 4, cy - 3); ctx.lineTo(cx + 4, cy + 3); }
      else { ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 3, cy - 1); ctx.lineTo(cx + 3, cy - 1); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx - 3, cy + 1); ctx.lineTo(cx + 3, cy + 1); }
      ctx.fill();
    });
  }
  function drawFlag(L, t) {
    const x = Math.round(L.flag.x), y = Math.round(L.flag.y);
    ctx.fillStyle = '#5c4326'; ctx.fillRect(x - 1, y - 72, 3, 72); ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - 2, y - 74, 5, 4);
    ctx.fillStyle = '#39b36b'; ctx.beginPath(); ctx.moveTo(x + 2, y - 70);
    for (let i = 0; i <= 20; i += 4) ctx.lineTo(x + 2 + i, y - 70 + Math.sin(t * 5 + i * 0.4) * 2 + i * 0.1);
    for (let i = 20; i >= 0; i -= 4) ctx.lineTo(x + 2 + i, y - 52 + Math.sin(t * 5 + i * 0.4) * 2 + i * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9ffe9'; ctx.font = 'bold 9px Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u2605', x + 10, y - 61);
  }
  function drawPlayer(g) {
    const p = g.p; let name, f;
    if (!p.onGround) { name = p.vy < -60 ? 'player_jump_up' : p.vy > 60 ? 'player_jump_down' : 'player_jump_mid'; f = Math.floor(g.t * 10) % 2; }
    else if (Math.abs(p.vx) > 12) { name = 'player_run'; f = frameAt(name, g.t); }
    else { name = 'player_idle'; f = frameAt(name, g.t); }
    const blink = g.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
    drawSprite(name, f, p.x, p.y, p.facing < 0, blink ? 0.35 : 1);
  }

  function drawHeart(x, y, fill) {
    const path = () => { ctx.beginPath(); ctx.moveTo(x + 6, y + 11); ctx.bezierCurveTo(x - 4, y + 4, x + 1, y - 3, x + 6, y + 2); ctx.bezierCurveTo(x + 11, y - 3, x + 16, y + 4, x + 6, y + 11); ctx.closePath(); };
    ctx.save(); path(); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#ff4d6d'; if (fill >= 1) ctx.fillRect(x - 6, y - 4, 24, 20); else if (fill > 0) ctx.fillRect(x - 6, y - 4, 12, 20);
    ctx.restore(); path(); ctx.lineWidth = 1; ctx.strokeStyle = '#3a0d18'; ctx.stroke();
  }
  function pill(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x + h / 2, y); ctx.arcTo(x + w, y, x + w, y + h, h / 2); ctx.arcTo(x + w, y + h, x, y + h, h / 2); ctx.arcTo(x, y + h, x, y, h / 2); ctx.arcTo(x, y, x + w, y, h / 2); ctx.closePath(); ctx.fill(); }
  function drawHUD(g) {
    pill(4, 4, 62, 16, 'rgba(6,16,10,.6)');
    for (let i = 0; i < 3; i++) drawHeart(9 + i * 19, 6, clamp(g.halves - i * 2, 0, 2) / 2);
    ctx.font = 'bold 9px Verdana, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const need = g.level.requirement;
    pill(VIEW_W - 176, 4, 172, 16, 'rgba(6,16,10,.6)');
    ctx.fillStyle = g.coins >= need.coins ? '#7bf0a9' : '#ffd54f'; ctx.fillText('\u2605 ' + g.coins + '/10', VIEW_W - 168, 12.5);
    ctx.fillStyle = g.stomps >= need.stomps ? '#7bf0a9' : '#c9f0a8'; ctx.fillText('Gremlins ' + g.stomps + '/8', VIEW_W - 118, 12.5);
    ctx.fillStyle = '#e8f5ec'; ctx.textAlign = 'right'; ctx.fillText(fmtTime(Math.floor(g.time)), VIEW_W - 8, 12.5);
    ctx.textAlign = 'center'; ctx.font = 'bold 8px Verdana, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText('Grade ' + g.grade + ' \u00b7 ' + g.level.name, VIEW_W / 2 - 10, 12.5);
    let y = VIEW_H - 14;
    for (let i = g.toasts.length - 1; i >= 0; i--) {
      const t = g.toasts[i]; ctx.globalAlpha = clamp(t.t / 0.4, 0, 1); ctx.font = 'bold 9px Verdana, sans-serif';
      const w = ctx.measureText(t.text).width + 16; pill(VIEW_W / 2 - w / 2, y - 8, w, 16, 'rgba(6,16,10,.78)'); ctx.fillStyle = t.color; ctx.textAlign = 'center'; ctx.fillText(t.text, VIEW_W / 2, y); y -= 20;
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  function render() {
    const s = canvas.width / VIEW_W;
    ctx.setTransform(s, 0, 0, s, 0, 0); ctx.imageSmoothingEnabled = false;
    const g = G, L = g.level, playing = L && g.p && g.state !== 'menu';
    const cam = playing ? Math.round(g.camX) : (g.t * 14) % 3000, theme = playing ? L.theme : 'sunny';
    drawBackground(theme, cam, g.t);
    if (!playing) return;
    ctx.save(); ctx.translate(-cam, 0);
    // chasms (and water) under the gaps
    L.gaps.forEach((gp) => {
      const x = gp.c0 * 16, w = (gp.c1 - gp.c0) * 16;
      if (theme === 'river') {
        ctx.fillStyle = '#1e5f75'; ctx.fillRect(x, 15 * 16, w, VIEW_H);
        ctx.fillStyle = 'rgba(160,230,255,.85)'; for (let i = 0; i < w; i += 8) ctx.fillRect(x + i, 15 * 16 + Math.round(Math.sin(g.t * 3 + (x + i) * 0.2) * 1.5), 6, 2);
      } else {
        const top = gp.s * 16, gr = ctx.createLinearGradient(0, top, 0, VIEW_H); gr.addColorStop(0, 'rgba(14,34,24,.55)'); gr.addColorStop(0.35, 'rgba(8,22,15,.96)'); gr.addColorStop(1, '#050d09'); ctx.fillStyle = gr; ctx.fillRect(x, top, w, VIEW_H - top);
      }
    });
    if (g.layer) ctx.drawImage(g.layer, 0, 0);
    drawMovers(L, theme, g.t);
    drawFlag(L, g.t);
    L.coins.forEach((c) => { if (!c.taken && c.x > cam - 20 && c.x < cam + VIEW_W + 20) drawCoin(c, g.t); });
    L.gremlins.forEach((gm) => { if (gm.x > cam - 60 && gm.x < cam + VIEW_W + 60) drawGremlin(gm, theme, g.t); });
    drawPlayer(g);
    g.particles.forEach((q) => {
      ctx.globalAlpha = clamp(q.life / 0.5, 0, 1);
      if (q.text) { ctx.font = 'bold 9px Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = q.color; ctx.fillText(q.text, Math.round(q.x), Math.round(q.y)); }
      else { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.r * 1.6, q.r * 1.6); }
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    drawHUD(g);
  }

  // ------------------------------------------------------------------
  // Buttons, layout, main loop
  // ------------------------------------------------------------------
  $('btnGo').addEventListener('click', () => { Sound.unlock(); begin(); });
  $('btnIntroBack').addEventListener('click', showMenu);
  $('btnResume').addEventListener('click', resume);
  $('btnRestart').addEventListener('click', () => startLevel(G.levelIndex));
  $('btnQuit').addEventListener('click', showMenu);
  $('btnNext').addEventListener('click', () => startLevel(G.levelIndex + 1));
  $('btnAgain').addEventListener('click', () => { if (G.levelIndex === LEVELS.length - 1 && G.results.length === LEVELS.length) startRun(G.grade); else startLevel(G.levelIndex); });
  $('btnDoneMenu').addEventListener('click', showMenu);
  $('btnRetry').addEventListener('click', () => startLevel(G.levelIndex));
  $('btnOverMenu').addEventListener('click', showMenu);
  $('btnPause').addEventListener('click', () => { if (G.state === 'play') pause(); else if (G.state === 'pause') resume(); });
  function syncSound() { $('btnSound').textContent = 'Sound: ' + (save.settings.sound ? 'On' : 'Off'); }
  $('btnSound').addEventListener('click', () => { save.settings.sound = !save.settings.sound; persist(); syncSound(); Sound.unlock(); });
  function syncMusicBtn() { $('btnMusic').textContent = 'Music: ' + (save.settings.music ? 'On' : 'Off'); }
  $('btnMusic').addEventListener('click', () => { save.settings.music = !save.settings.music; persist(); syncMusicBtn(); Sound.unlock(); syncMusic(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (G.state === 'intro' && document.activeElement === document.body) { e.preventDefault(); begin(); }
  });

  function fit() {
    const top = document.querySelector('.topbar').offsetHeight;
    const hint = document.querySelector('.rotate-hint'), hintH = hint && hint.offsetHeight ? hint.offsetHeight + 20 : 0;
    const aw = window.innerWidth - 16, ah = window.innerHeight - top - hintH - 14;
    const w = Math.max(280, Math.floor(Math.min(aw, ah * 16 / 9))), h = Math.floor(w * 9 / 16);
    stage.style.width = w + 'px'; stage.style.height = h + 'px'; stage.style.fontSize = (w / 46) + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  window.addEventListener('resize', fit);

  let last = performance.now();
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000); last = now;
    update(Math.min(raw, 1 / 30));
    render();
    requestAnimationFrame(frame);
  }

  // Test hook: open index.html?debug and use window.__mqr from the console (used by the play-tests).
  if (/[?&]debug\b/.test(location.search)) {
    window.__mqr = { get G() { return G; }, MusicPlayer, syncMusic, Sound, startRun, startLevel, begin, answer, engage, finishLevel, save, Ph, setKey, update, render };
  }

  fit(); syncSound(); syncMusicBtn();
  loadAll().then(() => { showMenu(); requestAnimationFrame(frame); });
})();
