// Music checks: every theme builds deterministically, notes are in a singable range and inside their bar, and `schedule`
// creates one oscillator per event.
const fs = require('fs'), vm = require('vm');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/music.js', 'utf8'), ctx);
const M = ctx.MQR.Music; let bad = 0;
const fail = (m) => { bad++; console.log('PROBLEM', m); };
for (const name of Object.keys(M.THEMES)) {
  const a = JSON.stringify(M.pattern(name));
  const c2 = { console }; c2.window = c2; vm.createContext(c2); vm.runInContext(fs.readFileSync('js/music.js', 'utf8'), c2);
  if (JSON.stringify(c2.MQR.Music.pattern(name)) !== a) fail(name + ': not deterministic');
  const pat = JSON.parse(a); let events = 0, lead = 0, distinct = new Set();
  if (pat.bars.length !== M.BARS) fail(name + ': wrong bar count');
  pat.bars.forEach((bar, bi) => bar.forEach((e) => {
    events++; if (e.v === 'lead') { lead++; distinct.add(e.m); }
    if (!(e.m >= 30 && e.m <= 96)) fail(name + ' bar ' + bi + ': note out of range ' + e.m);
    if (!(e.t >= 0 && e.t < M.BEATS && e.d > 0 && e.t + e.d <= M.BEATS + 0.001)) fail(name + ' bar ' + bi + ': event outside the bar ' + JSON.stringify(e));
  }));
  if (lead < 16 || distinct.size < 4) fail(name + ': melody too thin (' + lead + ' notes, ' + distinct.size + ' pitches)');
  const fake = { made: 0, createOscillator() { this.made++; return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }, createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
  const n = M.schedule(fake, {}, name, 3, 0);
  if (n !== pat.bars[3].length || fake.made !== n) fail(name + ': schedule created ' + fake.made + ' oscillators for ' + pat.bars[3].length + ' events');
  M.schedule(fake, {}, name, -1, 0);   // negative bar wraps
  console.log(name + ': ' + events + ' events over ' + M.BARS + ' bars, ' + lead + ' melody notes, ' + distinct.size + ' pitches, ' + M.barSeconds(name).toFixed(2) + 's per bar');
}
console.log('problems:', bad); process.exit(bad ? 1 : 0);
