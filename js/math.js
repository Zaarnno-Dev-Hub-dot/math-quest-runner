// Math Quest Runner: question generator.
// MQR.Math.make(grade, level, rng) -> { text, choices: [string x4], answer: index, expr, explain, how, why }
//   grade 1-5, level 1-3, rng = optional () => [0,1) (use MQR.Math.rng(seed) for repeatable tests)
// `expr` is a JavaScript expression that evaluates to the correct value, used by the tests to double-check answers.
// `how` is a short worked solution shown after a wrong answer; `why` maps each wrong choice (as displayed) to a
// one-line reason that mistake happens ("That adds. The problem says minus.").
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
  const MINUS = '\u2212', TIMES = '\u00d7', DIVIDE = '\u00f7';

  // ---- worked steps ("how") -----------------------------------------------------
  const tensOnes = (n) => [Math.floor(n / 10) * 10, n % 10];
  function addHow(a, b) {
    const s = a + b;
    if (a < 10 && b < 10) {
      if (s > 10) { const big = Math.max(a, b), small = Math.min(a, b), toTen = 10 - big; return 'Make a ten: ' + big + ' + ' + toTen + ' = 10, then add the other ' + (small - toTen) + ' to get ' + s + '.'; }
      return 'Start at ' + Math.max(a, b) + ' and count on ' + Math.min(a, b) + ' more: ' + s + '.';
    }
    const [ta, oa] = tensOnes(a), [tb, ob] = tensOnes(b);
    return 'Add the tens, then the ones: ' + ta + ' + ' + tb + ' = ' + (ta + tb) + ' and ' + oa + ' + ' + ob + ' = ' + (oa + ob) + '. Then ' + (ta + tb) + ' + ' + (oa + ob) + ' = ' + s + '.';
  }
  function subHow(a, b) {
    const d = a - b, check = ' Check: ' + d + ' + ' + b + ' = ' + a + '.';
    if (a > 10 && a < 20 && b < 10 && a % 10 < b) { const r = a % 10; return 'Go down to ten first: ' + a + ' ' + MINUS + ' ' + r + ' = ' + (a - r) + ', then take away ' + (b - r) + ' more to get ' + d + '.' + check; }
    if (a >= 20 && b >= 10) { const [tb, ob] = tensOnes(b), x = a - tb; return 'Take away the tens first: ' + a + ' ' + MINUS + ' ' + tb + ' = ' + x + (ob ? ', then the ones: ' + x + ' ' + MINUS + ' ' + ob + ' = ' + d : '') + '.' + check; }
    return 'Count back ' + b + ' from ' + a + ' to get ' + d + '.' + check;
  }
  function multHow(a, b) {
    const p = a * b, s = Math.min(a, b), L = Math.max(a, b);
    if (s === 10) return 'Times 10 just adds a zero: ' + L + ' ' + TIMES + ' 10 = ' + p + '.';
    if (s === 9) return '9 ' + TIMES + ' ' + L + ' is 10 ' + TIMES + ' ' + L + ' take away one ' + L + ': ' + (10 * L) + ' ' + MINUS + ' ' + L + ' = ' + p + '.';
    if (s >= 11) return s + ' ' + TIMES + ' ' + L + ' = 10 ' + TIMES + ' ' + L + ' + ' + (s - 10) + ' ' + TIMES + ' ' + L + ' = ' + (10 * L) + ' + ' + ((s - 10) * L) + ' = ' + p + '.';
    const seq = []; for (let i = 1; i <= s; i++) seq.push(L * i);
    return 'Skip count by ' + L + ', ' + s + ' times: ' + seq.join(', ') + '. So ' + a + ' ' + TIMES + ' ' + b + ' = ' + p + '.';
  }
  function divHow(divisor, q) {
    const total = divisor * q;
    if (q <= 8) { const seq = []; for (let i = 1; i <= q; i++) seq.push(divisor * i); return 'Ask: ' + divisor + ' ' + TIMES + ' ? = ' + total + '. Count by ' + divisor + ': ' + seq.join(', ') + '. That took ' + q + ' jumps, so ' + total + ' ' + DIVIDE + ' ' + divisor + ' = ' + q + '.'; }
    return 'Use the ' + divisor + ' times table: ' + divisor + ' ' + TIMES + ' ' + q + ' = ' + total + ', so ' + total + ' ' + DIVIDE + ' ' + divisor + ' = ' + q + '.';
  }
  // First message wins when two mistakes give the same number.
  function mk(pairs) { const m = {}; pairs.forEach(([k, t]) => { if (!(k in m)) m[k] = t; }); return m; }
  function nearMsg(d) {
    const a = Math.abs(d);
    if (a === 1) return 'Only one off. Recount step by step.';
    if (a === 2) return 'Two off. Slow down and check each step.';
    if (a === 10) return 'That is a whole ten off. Check your tens.';
    return 'That does not match the steps below.';
  }

  // ---- answer helpers ---------------------------------------------------------
  function numeric(text, value, expr, explain, extra, how, misses) {
    // Wrong answers that look like real mistakes: off by one or two, off by ten, the neighbouring fact.
    const cand = new Set([value + 1, value - 1, value + 2, value - 2, value + 10, value - 10]);
    (extra || []).forEach((v) => cand.add(v));
    const wrong = shuffle([...cand].filter((v) => Number.isInteger(v) && v >= 0 && v !== value))
      .map((v) => ({ v, k: Math.abs(v - value) + R.r() * 3 })).sort((a, b) => a.k - b.k).map((o) => o.v);
    const set = [value, ...wrong.slice(0, 3)];
    while (set.length < 4) { const v = value + int(3, 12); if (!set.includes(v)) set.push(v); }
    const why = {};
    set.slice(1).forEach((v) => { why[String(v)] = (misses && misses[v]) || nearMsg(v - value); });
    return finish(text, set.map(String), String(value), expr, explain, how, why);
  }
  function finish(text, choices, correct, expr, explain, how, why) {
    const shuffled = shuffle(choices.slice());
    return { text, choices: shuffled, answer: shuffled.indexOf(correct), expr, explain: explain || '', how: how || '', why: why || {} };
  }
  // Wrong fraction answers: a message per shown choice, generic for any left over.
  function whyFor(choices, correct, msgs, fallback) {
    const why = {};
    choices.forEach((c) => { if (c !== correct) why[c] = msgs[c] || fallback; });
    return why;
  }
  function frac(n, d) { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : n + '/' + d; }
  function decimal(v, dp) { return (Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp); }

  // ---- generators ---------------------------------------------------------------
  function addSub(max, minSub) {
    if (R.r() < 0.5) { const a = int(1, max - 1), b = int(1, max - a); return numeric(a + ' + ' + b + ' = ?', a + b, a + ' + ' + b, a + ' plus ' + b + ' is ' + (a + b) + '.', [Math.abs(a - b)], addHow(a, b), mk([[Math.abs(a - b), 'That takes ' + b + ' away. The problem says plus, so add.']])); }
    const a = int(minSub || 2, max), b = int(1, a); return numeric(a + ' ' + MINUS + ' ' + b + ' = ?', a - b, a + ' - ' + b, a + ' minus ' + b + ' is ' + (a - b) + '.', [a + b], subHow(a, b), mk([[a + b, 'That adds. The problem says minus, so take away.']]));
  }
  function mult(maxA, maxB, minA) {
    const a = int(minA || 2, maxA), b = int(2, maxB);
    return numeric(a + ' ' + TIMES + ' ' + b + ' = ?', a * b, a + ' * ' + b, a + ' times ' + b + ' is ' + a * b + '.', [(a + 1) * b, (a - 1) * b, a * (b + 1), a + b], multHow(a, b), mk([
      [a + b, 'That adds. ' + TIMES + ' means ' + a + ' groups of ' + b + '.'],
      [(a + 1) * b, 'That is ' + (a + 1) + ' ' + TIMES + ' ' + b + ', the next fact up. Use ' + a + ' groups.'],
      [(a - 1) * b, 'That is ' + (a - 1) + ' ' + TIMES + ' ' + b + ', the fact before. Use ' + a + ' groups.'],
      [a * (b + 1), 'That is ' + a + ' ' + TIMES + ' ' + (b + 1) + '. This one uses ' + b + '.'],
    ]));
  }
  function div(maxQ, maxB) {
    const b = int(2, maxB), q = int(2, maxQ), total = b * q;
    const back = (v) => 'Check by multiplying back: ' + b + ' ' + TIMES + ' ' + v + ' = ' + (b * v) + ', not ' + total + '.';
    return numeric(total + ' ' + DIVIDE + ' ' + b + ' = ?', q, total + ' / ' + b, total + ' split into groups of ' + b + ' makes ' + q + '.', [b, q * 2], divHow(b, q), mk([
      [b, 'That is the number you divided by. Ask what times ' + b + ' makes ' + total + '.'],
      [q * 2, back(q * 2)], [q + 1, back(q + 1)], [q - 1, back(q - 1)], [q + 2, back(q + 2)], [q - 2, back(q - 2)],
    ]));
  }
  function wordAddSub(max) {
    const n = pick(NAMES), t = pick(THINGS);
    if (R.r() < 0.5) { const a = int(3, max - 3), b = int(2, max - a); return numeric(n + ' has ' + a + ' ' + t + ' and finds ' + b + ' more. How many now?', a + b, a + ' + ' + b, a + ' + ' + b + ' = ' + (a + b) + '.', [Math.abs(a - b)], 'Finding more means add. ' + addHow(a, b), mk([[Math.abs(a - b), 'That takes ' + b + ' away. ' + n + ' finds more, so add.']])); }
    const a = int(6, max), b = int(2, a - 1); return numeric(n + ' has ' + a + ' ' + t + ' and gives away ' + b + '. How many are left?', a - b, a + ' - ' + b, a + ' ' + MINUS + ' ' + b + ' = ' + (a - b) + '.', [a + b], 'Giving away means take away. ' + subHow(a, b), mk([[a + b, 'That adds. ' + n + ' gives some away, so take away.']]));
  }
  function wordGroups(maxA, maxB) {
    const n = pick(NAMES), t = pick(THINGS), a = int(2, maxA), b = int(2, maxB);
    if (R.r() < 0.6) return numeric(n + ' has ' + a + ' bags with ' + b + ' ' + t + ' in each. How many ' + t + ' in all?', a * b, a + ' * ' + b, a + ' bags of ' + b + ' is ' + a * b + '.', [a + b, (a + 1) * b], 'Bags that are all the same size: multiply. ' + multHow(a, b), mk([[a + b, 'That adds the two numbers. Equal bags mean ' + TIMES + '.'], [(a + 1) * b, 'That counts ' + (a + 1) + ' bags. There are ' + a + '.']]));
    return numeric(n + ' shares ' + a * b + ' ' + t + ' equally among ' + a + ' friends. How many does each friend get?', b, (a * b) + ' / ' + a, a * b + ' ' + DIVIDE + ' ' + a + ' = ' + b + '.', [a, b + 1], 'Sharing equally means divide. ' + divHow(a, b), mk([[a, 'That is the number of friends. Each one gets a share of ' + (a * b) + '.'], [b + 1, 'Check by multiplying back: ' + a + ' ' + TIMES + ' ' + (b + 1) + ' = ' + (a * (b + 1)) + ', not ' + (a * b) + '.']]));
  }
  function multiDigit() {
    const a = int(12, 49), b = int(2, 9), [ta, oa] = tensOnes(a), p = a * b;
    return numeric(a + ' ' + TIMES + ' ' + b + ' = ?', p, a + ' * ' + b, a + ' ' + TIMES + ' ' + b + ' = ' + p + '.', [(a - 1) * b, p + b, p - 10, (a + 1) * b],
      'Split ' + a + ' into ' + ta + ' and ' + oa + ': ' + ta + ' ' + TIMES + ' ' + b + ' = ' + (ta * b) + ' and ' + oa + ' ' + TIMES + ' ' + b + ' = ' + (oa * b) + '. Add them: ' + (ta * b) + ' + ' + (oa * b) + ' = ' + p + '.',
      mk([[(a - 1) * b, 'That is ' + (a - 1) + ' ' + TIMES + ' ' + b + '. The number is ' + a + '.'], [(a + 1) * b, 'That is ' + (a + 1) + ' ' + TIMES + ' ' + b + '. The number is ' + a + '.'], [p + b, 'That is one group of ' + b + ' too many.']]));
  }
  function fractionEquivalent() {
    const n = int(1, 4), d = int(n + 1, 6), k = int(2, 4);
    const correct = String(n * k);
    const set = [correct, String(n + k), String(n * k + 1), String(n * (k + 1))].filter((v, i, a) => a.indexOf(v) === i);
    while (set.length < 4) set.push(String(n * k + set.length + 1));
    const shown = shuffle(set.slice());
    const why = whyFor(shown, correct, {
      [String(n + k)]: 'Adding ' + k + ' is not the same as multiplying by ' + k + '. Do the same to top and bottom.',
      [String(n * (k + 1))]: 'That multiplies by ' + (k + 1) + '. The bottom was multiplied by ' + k + '.',
    }, 'Close, but the top has to change the same way as the bottom.');
    return { text: n + '/' + d + ' = ?/' + d * k, choices: shown, answer: shown.indexOf(correct), expr: n + ' * ' + k, explain: 'Multiply top and bottom by ' + k + ': ' + n * k + '/' + d * k + '.',
      how: 'The bottom went from ' + d + ' to ' + d * k + ', which is ' + TIMES + ' ' + k + '. Do the same to the top: ' + n + ' ' + TIMES + ' ' + k + ' = ' + n * k + '.', why };
  }
  function fractionAddLike() {
    const d = int(3, 10), a = int(1, d - 2), b = int(1, d - a - 1 || 1);
    const ans = frac(a + b, d);
    const set = [ans, frac(a + b, d * 2), frac(a * b, d), frac(a + b, d + d)];
    const uniq = set.filter((v, i, arr) => arr.indexOf(v) === i);
    while (uniq.length < 4) { const x = frac(a + b + uniq.length, d + 1); if (!uniq.includes(x)) uniq.push(x); else uniq.push(frac(int(1, 9), int(10, 12))); }
    const shown = shuffle(uniq.slice(0, 4));
    const why = whyFor(shown, ans, {
      [frac(a + b, d * 2)]: 'When the bottoms already match, they stay the same. Do not add them.',
      [frac(a * b, d)]: 'Add the tops. Do not multiply them.',
    }, 'The bottom stays ' + d + ' and the tops add up.');
    return { text: a + '/' + d + ' + ' + b + '/' + d + ' = ?', choices: shown, answer: shown.indexOf(ans), expr: a + '/' + d + ' + ' + b + '/' + d, explain: 'Same bottom number: add the tops. ' + a + ' + ' + b + ' = ' + (a + b) + ' over ' + d + '.',
      how: 'The bottoms match, so keep the bottom (' + d + ') and add the tops: ' + a + ' + ' + b + ' = ' + (a + b) + '. That is ' + (a + b) + '/' + d + (ans !== (a + b) + '/' + d ? ', which simplifies to ' + ans : '') + '.', why };
  }
  function fractionOfSet() {
    const d = pick([2, 3, 4, 5]), k = int(1, d - 1), whole = d * int(2, 5), n = pick(NAMES);
    const val = (whole / d) * k, part = whole / d;
    return numeric(n + ' has ' + whole + ' ' + pick(THINGS) + '. ' + k + '/' + d + ' of them are shiny. How many are shiny?', val, whole + ' / ' + d + ' * ' + k, 'Split ' + whole + ' into ' + d + ' parts of ' + part + ', then take ' + k + '.', [part, val + part],
      'Split ' + whole + ' into ' + d + ' equal parts: ' + whole + ' ' + DIVIDE + ' ' + d + ' = ' + part + ' each. Take ' + k + ' part' + (k > 1 ? 's' : '') + ': ' + part + ' ' + TIMES + ' ' + k + ' = ' + val + '.',
      mk([[part, 'That is just one part. You need ' + k + ' parts.'], [val + part, 'That is one part too many.']]));
  }
  function fractionCompare() {
    let a, b, c, d;
    do { a = int(1, 5); b = int(a + 1, 8); c = int(1, 5); d = int(c + 1, 8); } while (a * d === c * b);
    const left = a / b > c / d;
    const first = a + '/' + b, second = c + '/' + d, correct = left ? first : second, other = left ? second : first;
    const shown = shuffle([first, second, 'they are equal', 'cannot tell']);
    const dv = (x, y) => decimal(x / y, 2);
    const why = whyFor(shown, correct, {
      [other]: 'That one is smaller: ' + first + ' is ' + dv(a, b) + ' and ' + second + ' is ' + dv(c, d) + '.',
      'they are equal': 'They are not equal: ' + dv(a, b) + ' and ' + dv(c, d) + '.',
      'cannot tell': 'You can always tell: turn each fraction into a decimal.',
    }, 'Compare them as decimals.');
    return { text: 'Which is bigger?', choices: shown, answer: shown.indexOf(correct), expr: 'Math.max(' + a + '/' + b + ',' + c + '/' + d + ')',
      explain: 'Compare ' + first + ' (' + dv(a, b) + ') with ' + second + ' (' + dv(c, d) + ').',
      how: 'Turn each fraction into a decimal: ' + first + ' = ' + dv(a, b) + ' and ' + second + ' = ' + dv(c, d) + '. The bigger one is ' + correct + '.', why };
  }
  function fractionAddUnlike() {
    const pairs = [[2, 4], [2, 6], [3, 6], [2, 8], [4, 8], [5, 10], [2, 10], [3, 9]];
    const [d1, d2] = pick(pairs), n1 = int(1, d1 - 1), n2 = int(1, d2 - 1);
    const num = n1 * d2 + n2 * d1, den = d1 * d2;
    const ans = frac(num, den), wrong = frac(n1 + n2, d1 + d2);
    const set = [ans, wrong, frac(n1 + n2, Math.max(d1, d2)), frac(num + 1, den)].filter((v, i, a) => a.indexOf(v) === i);
    while (set.length < 4) set.push(frac(num + set.length + 1, den));
    const shown = shuffle(set.slice(0, 4));
    const why = whyFor(shown, ans, {
      [wrong]: 'Do not add the bottoms as well. Make them match first.',
      [frac(n1 + n2, Math.max(d1, d2))]: 'The bottoms have to be changed to match, not just picked.',
      [frac(num + 1, den)]: 'Very close. Check the tops again.',
    }, 'Make the bottoms match first, then add the tops.');
    return { text: n1 + '/' + d1 + ' + ' + n2 + '/' + d2 + ' = ?', choices: shown, answer: shown.indexOf(ans), expr: n1 + '/' + d1 + ' + ' + n2 + '/' + d2, explain: 'Make the bottoms match first, then add the tops.',
      how: 'Make the bottoms match: use ' + den + '. ' + n1 + '/' + d1 + ' = ' + (n1 * d2) + '/' + den + ' and ' + n2 + '/' + d2 + ' = ' + (n2 * d1) + '/' + den + '. Add the tops: ' + num + '/' + den + (ans !== num + '/' + den ? ', which simplifies to ' + ans : '') + '.', why };
  }  function decimalAddSub() {
    const dp = pick([1, 1, 2]), scale = Math.pow(10, dp);
    let a = int(1, 99) / scale + int(0, 4), b = int(1, 60) / scale;
    a = Math.round(a * scale) / scale; b = Math.round(b * scale) / scale;
    const plus = R.r() < 0.5 || a < b;
    const v = plus ? a + b : a - b, ans = decimal(v, dp);
    const set = [ans, decimal(v + 1 / scale, dp), decimal(v - 1 / scale, dp), decimal(v + 1, dp)].filter((x, i, arr) => arr.indexOf(x) === i && parseFloat(x) >= 0);
    while (set.length < 4) set.push(decimal(v + (set.length + 1) * 10 / scale, dp));
    const shown = shuffle(set.slice(0, 4));
    const sa = decimal(a, dp), sb = decimal(b, dp), op = plus ? ' + ' : ' ' + MINUS + ' ';
    const why = whyFor(shown, ans, {
      [decimal(v + 1 / scale, dp)]: 'Only the last digit is off. Check that column.',
      [decimal(v - 1 / scale, dp)]: 'Only the last digit is off. Check that column.',
      [decimal(v + 1, dp)]: 'A whole number too big. Check the ones column.',
    }, 'Line up the decimal points and work one column at a time.');
    return { text: sa + op + sb + ' = ?', choices: shown, answer: shown.indexOf(ans), expr: sa + (plus ? ' + ' : ' - ') + sb, explain: 'Line up the decimal points, then ' + (plus ? 'add.' : 'subtract.'),
      how: 'Line up the decimal points and ' + (plus ? 'add' : 'subtract') + ' each column from the right: ' + sa + op + sb + ' = ' + ans + '.', why };
  }
  function decimalTimesTen() {
    const dp = pick([1, 2]), a = decimal(int(11, 99) / Math.pow(10, dp), dp), m = pick([10, 100]);
    const v = parseFloat(a) * m, ans = String(Math.round(v * 1000) / 1000);
    const set = [ans, String(v / 10), String(v * 10), String(Math.round(parseFloat(a) * (m === 10 ? 100 : 10) * 1000) / 1000)].filter((x, i, arr) => arr.indexOf(x) === i);
    while (set.length < 4) set.push(String(Math.round(v * (set.length + 2) * 1000) / 1000));
    const shown = shuffle(set.slice(0, 4));
    const why = whyFor(shown, ans, {
      [String(v / 10)]: 'That moved the point one place too few.',
      [String(v * 10)]: 'That moved the point one place too far.',
    }, 'Times 10 and times 100 move the point different distances.');
    return { text: a + ' ' + TIMES + ' ' + m + ' = ?', choices: shown.slice(0, 4), answer: shown.indexOf(ans), expr: a + ' * ' + m, explain: 'Multiplying by ' + m + ' moves the decimal point ' + (m === 10 ? 'one place' : 'two places') + ' to the right.',
      how: 'Times ' + m + ' moves the decimal point ' + (m === 10 ? 'one place' : 'two places') + ' to the right: ' + a + ' ' + TIMES + ' ' + m + ' = ' + ans + '.', why };
  }
  function orderOfOps() {
    const t = int(0, 3);
    let text, val, expr, how, lr = null;
    if (t === 0) { const a = int(2, 9), b = int(2, 6), c = int(2, 6); val = a + b * c; text = a + ' + ' + b + ' ' + TIMES + ' ' + c; expr = a + ' + ' + b + ' * ' + c; how = 'Times comes before plus. First ' + b + ' ' + TIMES + ' ' + c + ' = ' + (b * c) + ', then ' + a + ' + ' + (b * c) + ' = ' + val + '.'; lr = (a + b) * c; }
    else if (t === 1) { const a = int(2, 6), b = int(2, 6), c = int(2, 6); val = (a + b) * c; text = '(' + a + ' + ' + b + ') ' + TIMES + ' ' + c; expr = '(' + a + ' + ' + b + ') * ' + c; how = 'Brackets first: ' + a + ' + ' + b + ' = ' + (a + b) + ', then ' + (a + b) + ' ' + TIMES + ' ' + c + ' = ' + val + '.'; lr = a + b * c; }
    else if (t === 2) { const b = int(2, 5), c = int(2, 5), a = b * c + int(1, 12); val = a - b * c; text = a + ' ' + MINUS + ' ' + b + ' ' + TIMES + ' ' + c; expr = a + ' - ' + b + ' * ' + c; how = 'Times comes before minus. First ' + b + ' ' + TIMES + ' ' + c + ' = ' + (b * c) + ', then ' + a + ' ' + MINUS + ' ' + (b * c) + ' = ' + val + '.'; lr = (a - b) * c; }
    else { const c = int(2, 5), a = c * int(2, 6), b = int(2, 9); val = a / c + b; text = a + ' ' + DIVIDE + ' ' + c + ' + ' + b; expr = a + ' / ' + c + ' + ' + b; how = 'Divide before you add. First ' + a + ' ' + DIVIDE + ' ' + c + ' = ' + (a / c) + ', then ' + (a / c) + ' + ' + b + ' = ' + val + '.'; }
    const extra = [val + 2, val - 2, val + 6]; const misses = {};
    if (lr !== null && lr !== val) { extra.push(lr); misses[lr] = 'That works left to right. Brackets, then times and divide, come first.'; }
    return numeric(text + ' = ?', val, expr, 'Multiply and divide before you add and subtract; brackets go first.', extra, how, misses);
  }
  function decimalWord() {
    const n = pick(NAMES), a = int(12, 60) / 10, b = int(5, 40) / 10, dp = 1;
    const v = a + b, ans = decimal(v, dp);
    const set = [ans, decimal(v + 0.1, dp), decimal(v - 0.1, dp), decimal(v + 1, dp)];
    const shown = shuffle(set.slice());
    const why = whyFor(shown, ans, {
      [decimal(v + 0.1, dp)]: 'Only the tenths digit is off. Check it.',
      [decimal(v - 0.1, dp)]: 'Only the tenths digit is off. Check it.',
      [decimal(v + 1, dp)]: 'A whole km too many. Check the ones.',
    }, 'Line up the decimal points and add.');
    return { text: n + ' walks ' + decimal(a, dp) + ' km, then ' + decimal(b, dp) + ' km more. How far in all?', choices: shown, answer: shown.indexOf(ans), expr: decimal(a, dp) + ' + ' + decimal(b, dp),
      explain: decimal(a, dp) + ' + ' + decimal(b, dp) + ' = ' + ans + ' km.', how: 'Going further means add. Line up the decimal points: ' + decimal(a, dp) + ' + ' + decimal(b, dp) + ' = ' + ans + ' km.', why };
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