// Math Quest Runner: question generator.
// MQR.Math.make(grade, level, rng) -> { text, choices: [string x4], answer: index, expr, explain }
//   grade 1-5, level 1-3, rng = optional () => [0,1) (use MQR.Math.rng(seed) for repeatable tests)
// `expr` is a JavaScript expression that evaluates to the correct value, used by the tests to double-check answers.
window.MQR = window.MQR || {};
(function () {
  'use strict';

  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = { r: Math.random };
  const int = (a, b) => a + Math.floor(R.r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(R.r() * arr.length)];
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R.r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const NAMES = ['Mia', 'Leo', 'Ava', 'Sam', 'Zoe', 'Max', 'Ivy', 'Ben', 'Lila', 'Omar', 'Nia', 'Kai'];
  const THINGS = ['apples', 'stickers', 'marbles', 'shells', 'berries', 'coins', 'feathers', 'seeds'];

  // ---- answer helpers ---------------------------------------------------------
  function numeric(text, value, expr, explain, extra) {
    // Wrong answers that look like real mistakes: off by one or two, off by ten, the neighbouring fact.
    const cand = new Set([value + 1, value - 1, value + 2, value - 2, value + 10, value - 10]);
    (extra || []).forEach((v) => cand.add(v));
    const wrong = shuffle([...cand].filter((v) => Number.isInteger(v) && v >= 0 && v !== value))
      .map((v) => ({ v, k: Math.abs(v - value) + R.r() * 3 })).sort((a, b) => a.k - b.k).map((o) => o.v);
    const set = [value, ...wrong.slice(0, 3)];
    while (set.length < 4) { const v = value + int(3, 12); if (!set.includes(v)) set.push(v); }
    return finish(text, set.map(String), String(value), expr, explain);
  }
  function finish(text, choices, correct, expr, explain) {
    const shuffled = shuffle(choices.slice());
    return { text, choices: shuffled, answer: shuffled.indexOf(correct), expr, explain: explain || '' };
  }
  function frac(n, d) { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : n + '/' + d; }
  function decimal(v, dp) { return (Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp); }

  // ---- generators ---------------------------------------------------------------
  function addSub(max, minSub) {
    if (R.r() < 0.5) { const a = int(1, max - 1), b = int(1, max - a); return numeric(a + ' + ' + b + ' = ?', a + b, a + ' + ' + b, a + ' plus ' + b + ' is ' + (a + b) + '.', [Math.abs(a - b)]); }
    const a = int(minSub || 2, max), b = int(1, a); return numeric(a + ' \u2212 ' + b + ' = ?', a - b, a + ' - ' + b, a + ' minus ' + b + ' is ' + (a - b) + '.', [a + b]);
  }
  function mult(maxA, maxB, minA) {
    const a = int(minA || 2, maxA), b = int(2, maxB);
    return numeric(a + ' \u00d7 ' + b + ' = ?', a * b, a + ' * ' + b, a + ' times ' + b + ' is ' + a * b + '.', [(a + 1) * b, (a - 1) * b, a * (b + 1), a + b]);
  }
  function div(maxQ, maxB) {
    const b = int(2, maxB), q = int(2, maxQ);
    return numeric(b * q + ' \u00f7 ' + b + ' = ?', q, (b * q) + ' / ' + b, b * q + ' split into groups of ' + b + ' makes ' + q + '.', [b, q * 2]);
  }
  function wordAddSub(max) {
    const n = pick(NAMES), t = pick(THINGS);
    if (R.r() < 0.5) { const a = int(3, max - 3), b = int(2, max - a); return numeric(n + ' has ' + a + ' ' + t + ' and finds ' + b + ' more. How many now?', a + b, a + ' + ' + b, a + ' + ' + b + ' = ' + (a + b) + '.', [Math.abs(a - b)]); }
    const a = int(6, max), b = int(2, a - 1); return numeric(n + ' has ' + a + ' ' + t + ' and gives away ' + b + '. How many are left?', a - b, a + ' - ' + b, a + ' \u2212 ' + b + ' = ' + (a - b) + '.', [a + b]);
  }
  function wordGroups(maxA, maxB) {
    const n = pick(NAMES), t = pick(THINGS), a = int(2, maxA), b = int(2, maxB);
    if (R.r() < 0.6) return numeric(n + ' has ' + a + ' bags with ' + b + ' ' + t + ' in each. How many ' + t + ' in all?', a * b, a + ' * ' + b, a + ' bags of ' + b + ' is ' + a * b + '.', [a + b, (a + 1) * b]);
    return numeric(n + ' shares ' + a * b + ' ' + t + ' equally among ' + a + ' friends. How many does each friend get?', b, (a * b) + ' / ' + a, a * b + ' \u00f7 ' + a + ' = ' + b + '.', [a, b + 1]);
  }
  function multiDigit() {
    const a = int(12, 49), b = int(2, 9);
    return numeric(a + ' \u00d7 ' + b + ' = ?', a * b, a + ' * ' + b, a + ' \u00d7 ' + b + ' = ' + a * b + '.', [(a - 1) * b, a * b + b, a * b - 10, (a + 1) * b]);
  }
  function fractionEquivalent() {
    const n = int(1, 4), d = int(n + 1, 6), k = int(2, 4);
    const correct = String(n * k);
    const set = [correct, String(n + k), String(n * k + 1), String(n * (k + 1))].filter((v, i, a) => a.indexOf(v) === i);
    while (set.length < 4) set.push(String(n * k + set.length + 1));
    return finish(n + '/' + d + ' = ?/' + d * k, set, correct, n + ' * ' + k, 'Multiply top and bottom by ' + k + ': ' + n * k + '/' + d * k + '.');
  }
  function fractionAddLike() {
    const d = int(3, 10), a = int(1, d - 2), b = int(1, d - a - 1 || 1);
    const ans = frac(a + b, d);
    const set = [ans, frac(a + b, d * 2), frac(a * b, d), frac(a + b, d + d)];
    const uniq = set.filter((v, i, arr) => arr.indexOf(v) === i);
    while (uniq.length < 4) { const x = frac(a + b + uniq.length, d + 1); if (!uniq.includes(x)) uniq.push(x); else uniq.push(frac(int(1, 9), int(10, 12))); }
    return finish(a + '/' + d + ' + ' + b + '/' + d + ' = ?', uniq.slice(0, 4), ans, a + '/' + d + ' + ' + b + '/' + d, 'Same bottom number: add the tops. ' + a + ' + ' + b + ' = ' + (a + b) + ' over ' + d + '.');
  }
  function fractionOfSet() {
    const d = pick([2, 3, 4, 5]), k = int(1, d - 1), whole = d * int(2, 5), n = pick(NAMES);
    const val = (whole / d) * k;
    return numeric(n + ' has ' + whole + ' ' + pick(THINGS) + '. ' + k + '/' + d + ' of them are shiny. How many are shiny?', val, whole + ' / ' + d + ' * ' + k, 'Split ' + whole + ' into ' + d + ' parts of ' + whole / d + ', then take ' + k + '.', [whole / d, val + whole / d]);
  }
  function fractionCompare() {
    let a, b, c, d;
    do { a = int(1, 5); b = int(a + 1, 8); c = int(1, 5); d = int(c + 1, 8); } while (a * d === c * b);
    const left = a / b > c / d;
    const correct = left ? a + '/' + b : c + '/' + d;
    return finish('Which is bigger?', shuffle([a + '/' + b, c + '/' + d, 'they are equal', 'cannot tell']), correct, 'Math.max(' + a + '/' + b + ',' + c + '/' + d + ')', 'Compare ' + a + '/' + b + ' (' + decimal(a / b, 2) + ') with ' + c + '/' + d + ' (' + decimal(c / d, 2) + ').');
  }
  function fractionAddUnlike() {
    const pairs = [[2, 4], [2, 6], [3, 6], [2, 8], [4, 8], [5, 10], [2, 10], [3, 9]];
    const [d1, d2] = pick(pairs), n1 = int(1, d1 - 1), n2 = int(1, d2 - 1);
    const num = n1 * d2 + n2 * d1, den = d1 * d2;
    const ans = frac(num, den), wrong = frac(n1 + n2, d1 + d2);
    const set = [ans, wrong, frac(n1 + n2, Math.max(d1, d2)), frac(num + 1, den)].filter((v, i, a) => a.indexOf(v) === i);
    while (set.length < 4) set.push(frac(num + set.length + 1, den));
    return finish(n1 + '/' + d1 + ' + ' + n2 + '/' + d2 + ' = ?', set.slice(0, 4), ans, n1 + '/' + d1 + ' + ' + n2 + '/' + d2, 'Make the bottoms match first, then add the tops.');
  }
  function decimalAddSub() {
    const dp = pick([1, 1, 2]), scale = Math.pow(10, dp);
    let a = int(1, 99) / scale + int(0, 4), b = int(1, 60) / scale;
    a = Math.round(a * scale) / scale; b = Math.round(b * scale) / scale;
    const plus = R.r() < 0.5 || a < b;
    const v = plus ? a + b : a - b, ans = decimal(v, dp);
    const set = [ans, decimal(v + 1 / scale, dp), decimal(v - 1 / scale, dp), decimal(v + 1, dp)].filter((x, i, arr) => arr.indexOf(x) === i && parseFloat(x) >= 0);
    while (set.length < 4) set.push(decimal(v + (set.length + 1) * 10 / scale, dp));
    return finish(decimal(a, dp) + (plus ? ' + ' : ' \u2212 ') + decimal(b, dp) + ' = ?', set.slice(0, 4), ans, decimal(a, dp) + (plus ? ' + ' : ' - ') + decimal(b, dp), 'Line up the decimal points, then ' + (plus ? 'add.' : 'subtract.'));
  }
  function decimalTimesTen() {
    const dp = pick([1, 2]), a = decimal(int(11, 99) / Math.pow(10, dp), dp), m = pick([10, 100]);
    const v = parseFloat(a) * m, ans = String(Math.round(v * 1000) / 1000);
    const set = [ans, String(v / 10), String(v * 10), String(Math.round(parseFloat(a) * (m === 10 ? 100 : 10) * 1000) / 1000)].filter((x, i, arr) => arr.indexOf(x) === i);
    while (set.length < 4) set.push(String(Math.round(v * (set.length + 2) * 1000) / 1000));
    return finish(a + ' \u00d7 ' + m + ' = ?', set.slice(0, 4), ans, a + ' * ' + m, 'Multiplying by ' + m + ' moves the decimal point ' + (m === 10 ? 'one place' : 'two places') + ' to the right.');
  }
  function orderOfOps() {
    const t = int(0, 3);
    let text, val, expr;
    if (t === 0) { const a = int(2, 9), b = int(2, 6), c = int(2, 6); val = a + b * c; text = a + ' + ' + b + ' \u00d7 ' + c; expr = a + ' + ' + b + ' * ' + c; }
    else if (t === 1) { const a = int(2, 6), b = int(2, 6), c = int(2, 6); val = (a + b) * c; text = '(' + a + ' + ' + b + ') \u00d7 ' + c; expr = '(' + a + ' + ' + b + ') * ' + c; }
    else if (t === 2) { const b = int(2, 5), c = int(2, 5), a = b * c + int(1, 12); val = a - b * c; text = a + ' \u2212 ' + b + ' \u00d7 ' + c; expr = a + ' - ' + b + ' * ' + c; }
    else { const c = int(2, 5), a = c * int(2, 6), b = int(2, 9); val = a / c + b; text = a + ' \u00f7 ' + c + ' + ' + b; expr = a + ' / ' + c + ' + ' + b; }
    return numeric(text + ' = ?', val, expr, 'Multiply and divide before you add and subtract; brackets go first.', [val + 2, val - 2, val + 6]);
  }
  function decimalWord() {
    const n = pick(NAMES), a = int(12, 60) / 10, b = int(5, 40) / 10, dp = 1;
    const v = a + b, ans = decimal(v, dp);
    const set = [ans, decimal(v + 0.1, dp), decimal(v - 0.1, dp), decimal(v + 1, dp)];
    return finish(n + ' walks ' + decimal(a, dp) + ' km, then ' + decimal(b, dp) + ' km more. How far in all?', set, ans, decimal(a, dp) + ' + ' + decimal(b, dp), decimal(a, dp) + ' + ' + decimal(b, dp) + ' = ' + ans + ' km.');
  }

  const TABLE = {
    1: [() => addSub(10), () => addSub(20, 5), () => wordAddSub(20)],
    2: [() => addSub(50, 10), () => (R.r() < 0.6 ? addSub(100, 20) : mult(10, 10, 2)), () => (R.r() < 0.5 ? wordAddSub(100) : wordGroups(5, 10))],
    3: [() => mult(5, 5), () => (R.r() < 0.65 ? mult(10, 10) : div(10, 10)), () => wordGroups(9, 10)],
    4: [() => (R.r() < 0.6 ? multiDigit() : mult(12, 12)), () => (R.r() < 0.5 ? fractionEquivalent() : R.r() < 0.5 ? fractionAddLike() : fractionCompare()), () => (R.r() < 0.5 ? fractionOfSet() : R.r() < 0.5 ? wordGroups(9, 12) : multiDigit())],
    5: [() => (R.r() < 0.6 ? fractionAddUnlike() : fractionOfSet()), () => (R.r() < 0.6 ? decimalAddSub() : decimalTimesTen()), () => (R.r() < 0.6 ? orderOfOps() : decimalWord())],
  };

  MQR.Math = {
    rng,
    GRADES: [1, 2, 3, 4, 5],
    TOPICS: { 1: 'Adding and subtracting', 2: 'Adding, subtracting and times tables', 3: 'Multiplying and dividing', 4: 'Multiplying and fractions', 5: 'Fractions, decimals and order of operations' },
    make(grade, level, random) {
      R.r = random || Math.random;
      const g = Math.max(1, Math.min(5, grade | 0)), l = Math.max(1, Math.min(3, level | 0));
      return TABLE[g][l - 1]();
    },
  };
})();