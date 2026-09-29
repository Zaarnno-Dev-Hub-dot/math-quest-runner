// Math Quest Runner: background music. Original tunes, generated in code (no audio files).
// The pattern generator is pure (deterministic per theme) so it runs in Node for the tests; `schedule` plays one bar on any
// Web Audio context, including an OfflineAudioContext.
window.MQR = window.MQR || {};
(function () {
  'use strict';
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // key = MIDI note of the tonic, prog = [semitones above the key, 'M' major / 'm' minor] per bar, repeated over 8 bars.
  const THEMES = {
    sunny: { bpm: 112, key: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], seed: 11, arpStep: 0.5, leadWave: 'triangle' },
    ruins: { bpm: 92, key: 62, scale: [0, 3, 5, 7, 10], prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], seed: 22, arpStep: 0.5, leadWave: 'sine' },
    river: { bpm: 80, key: 55, scale: [0, 2, 4, 7, 9], prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], seed: 33, arpStep: 1, leadWave: 'sine' },
  };
  const BARS = 8, BEATS = 4;
  const RHYTHMS = [[0, 1, 2, 3], [0, 1.5, 2, 3], [0, 1, 2, 2.5, 3], [0.5, 1, 2, 3], [0, 1, 1.5, 2, 3]];
  const cache = {};

  function tones(root, q) { return [root, root + (q === 'm' ? 3 : 4), root + 7, root + 12]; }

  function build(name) {
    const th = THEMES[name]; if (!th) throw new Error('unknown theme ' + name);
    const r = prng(th.seed), pick = (a) => a[Math.floor(r() * a.length)];
    // Melody notes: the scale over two octaves above the key.
    const notes = []; [12, 24].forEach((o) => th.scale.forEach((s) => notes.push(th.key + o + s)));
    const nearest = (m) => notes.reduce((b, n, i) => (Math.abs(n - m) < Math.abs(notes[b] - m) ? i : b), 0);
    const lead = (bar, deg) => {
      const ev = [], rhythm = pick(RHYTHMS), chord = th.prog[bar % 4], root = th.key + chord[0] + 12;
      rhythm.forEach((t, i) => {
        deg = i === 0 ? nearest(root + pick([0, 4, 7])) : Math.max(0, Math.min(notes.length - 1, deg + pick([-2, -1, 0, 1, 2])));
        if (i > 0 && r() < 0.18) return;                                        // an occasional rest
        const next = i + 1 < rhythm.length ? rhythm[i + 1] : BEATS;
        ev.push({ t, d: Math.max(0.4, next - t - 0.1), m: notes[deg], v: 'lead' });
      });
      return { ev, deg };
    };
    const phrase = []; let deg = nearest(th.key + 19);
    for (let b = 0; b < 4; b++) { const o = lead(b, deg); phrase.push(o.ev); deg = o.deg; }
    const bars = [];
    for (let b = 0; b < BARS; b++) {
      const chord = th.prog[b % 4], root = th.key + chord[0], ev = [];
      ev.push({ t: 0, d: 1.8, m: root - 12, v: 'bass' }, { t: 2, d: 1.8, m: root - 12 + (b % 2 ? 7 : 0), v: 'bass' });
      const tt = tones(root, chord[1]), seq = [0, 1, 2, 3, 2, 1, 2, 1];
      for (let i = 0, t = 0; t < BEATS; i++, t += th.arpStep) ev.push({ t, d: th.arpStep * 0.9, m: tt[seq[i % seq.length]], v: 'arp' });
      const l = b === 7 ? lead(b, nearest(th.key + 19)).ev : phrase[b % 4];      // last bar turns the phrase around
      l.forEach((e) => ev.push(e));
      bars.push(ev);
    }
    return { name, bpm: th.bpm, bars };
  }
  function pattern(name) { return cache[name] || (cache[name] = build(name)); }

  const VOICE = { bass: { wave: 'triangle', vol: 0.10 }, arp: { wave: 'square', vol: 0.022 }, lead: { wave: null, vol: 0.06 } };
  // Play bar `barIndex` (any integer; wraps around) starting at time t0 on context `ac`, into node `dest`.
  function schedule(ac, dest, name, barIndex, t0) {
    const pat = pattern(name), th = THEMES[name], sec = 60 / pat.bpm;
    let n = 0;
    pat.bars[((barIndex % BARS) + BARS) % BARS].forEach((e) => {
      const v = VOICE[e.v], t = t0 + e.t * sec, dur = e.d * sec, o = ac.createOscillator(), g = ac.createGain();
      o.type = v.wave || th.leadWave; o.frequency.setValueAtTime(mtof(e.m), t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v.vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); n++;
    });
    return n;
  }
  const barSeconds = (name) => (60 / THEMES[name].bpm) * BEATS;

  MQR.Music = { THEMES, BARS, BEATS, pattern, schedule, barSeconds, mtof };
})();