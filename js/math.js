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
  // ---- more question types ------------------------------------------------------
  const weighted = (list) => () => { let t = 0; list.forEach((e) => { t += e[1]; }); let r = R.r() * t; for (const e of list) { r -= e[1]; if (r < 0) return e[0](); } return list[0][0](); };
  const K = (name, fn) => () => { const q = fn(); q.kind = name; return q; };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const uniqueInts = (count, lo, hi) => { const s = new Set(); while (s.size < count) s.add(int(lo, hi)); return [...s]; };

  function missingAddend(max) {
    const total = int(4, max), a = int(1, total - 1), b = total - a, form = int(0, 2);
    const text = form === 0 ? a + ' + ? = ' + total : form === 1 ? '? + ' + a + ' = ' + total : total + ' ' + MINUS + ' ? = ' + a;
    return numeric(text, b, total + ' - ' + a, 'The missing number is ' + b + '.', [total, a, total + a],
      'Ask what makes ' + total + ': take ' + a + ' away from ' + total + '. ' + total + ' ' + MINUS + ' ' + a + ' = ' + b + '. Check: ' + a + ' + ' + b + ' = ' + total + '.',
      mk([[total, 'That is the total. The missing part is smaller.'], [a, 'That is the number already shown. Find the other part.'], [total + a, 'That adds them. Take away instead.']]));
  }
  function missingFactor(maxA, maxB) {
    const a = int(2, maxA), b = int(2, maxB), p = a * b;
    const back = (v) => 'Check: ' + a + ' ' + TIMES + ' ' + v + ' = ' + (a * v) + ', not ' + p + '.';
    return numeric(a + ' ' + TIMES + ' ? = ' + p, b, p + ' / ' + a, a + ' ' + TIMES + ' ' + b + ' = ' + p + '.', [p, a, p - a],
      'Ask: ' + a + ' times what makes ' + p + '? Divide: ' + p + ' ' + DIVIDE + ' ' + a + ' = ' + b + '. Check: ' + a + ' ' + TIMES + ' ' + b + ' = ' + p + '.',
      mk([[p, 'That is the answer to the multiplication. Divide it by ' + a + '.'], [a, 'That is the number already shown.'], [p - a, 'That takes away. Use division.'], [b + 1, back(b + 1)], [b - 1, back(b - 1)]]));
  }
  function skipCount(tier) {
    const steps = [[2, 5, 10], [3, 4, 5, 10], [6, 7, 8, 9, 25]][tier - 1], k = pick(steps);
    const down = tier > 1 && R.r() < 0.3, dir = down ? -1 : 1;
    const start = down ? 4 * k + int(0, 2 * k) : (k >= 5 ? k * int(0, 3) : int(1, 12));
    const seq = [0, 1, 2, 3].map((i) => start + dir * k * i), last = seq[3], ans = last + dir * k;
    const jump = (v) => 'The jumps are ' + k + ' each time, not ' + Math.abs(v - last) + '.';
    return numeric(seq.join(', ') + ', ?', ans, last + (down ? ' - ' : ' + ') + k, 'Each number is ' + k + (down ? ' less' : ' more') + ' than the one before.', [last, last + dir * 2 * k, last + dir * (k + 1), last + dir * (k - 1)],
      'Each number is ' + k + (down ? ' less' : ' more') + ' than the one before (' + seq[0] + ' to ' + seq[1] + '). So ' + last + (down ? ' ' + MINUS + ' ' : ' + ') + k + ' = ' + ans + '.',
      mk([[last, 'That is the last number shown. Take one more jump.'], [last + dir * 2 * k, 'That jumps twice. Take just one jump of ' + k + '.'], [last + dir * (k + 1), jump(last + dir * (k + 1))], [last + dir * (k - 1), jump(last + dir * (k - 1))]]));
  }
  function compareNumbers(digits) {
    const lo = Math.pow(10, digits - 1), hi = Math.pow(10, digits) - 1, big = R.r() < 0.5;
    const base = int(lo + 1, hi - 1), rev = parseInt(String(base).split('').reverse().join(''), 10), nums = new Set([base]);
    if (rev >= lo && rev !== base) nums.add(rev);
    while (nums.size < 4) nums.add(int(lo, hi));
    const list = shuffle([...nums]), sorted = list.slice().sort((a, b) => a - b), ans = big ? sorted[3] : sorted[0], shown = list.map(String);
    const why = whyFor(shown, String(ans), Object.fromEntries(list.map((x) => [String(x), x + ' is ' + (big ? 'smaller' : 'bigger') + ' than ' + ans + '. Compare the places from the left.'])), 'Compare place by place.');
    return { text: 'Which number is the ' + (big ? 'greatest' : 'smallest') + '? ' + list.join(', '), choices: shown, answer: shown.indexOf(String(ans)), expr: 'Math.' + (big ? 'max' : 'min') + '(' + list.join(',') + ')',
      explain: ans + ' is the ' + (big ? 'greatest' : 'smallest') + '.', how: 'Compare place by place, starting from the left. Smallest to biggest: ' + sorted.join(', ') + '. So the ' + (big ? 'greatest' : 'smallest') + ' is ' + ans + '.', why };
  }
  function evenOdd(max) {
    const want = pick(['even', 'odd']), wantMod = want === 'even' ? 0 : 1, pool = [];
    for (let n = 2; n <= max; n++) pool.push(n);
    const right = shuffle(pool.filter((n) => n % 2 === wantMod)).slice(0, 1)[0], wrong = shuffle(pool.filter((n) => n % 2 !== wantMod)).slice(0, 3);
    const shown = shuffle([right, ...wrong]).map(String), other = want === 'even' ? 'odd' : 'even';
    const why = whyFor(shown, String(right), Object.fromEntries(wrong.map((x) => [String(x), x + ' ends in ' + (x % 10) + ', so it is ' + other + '.'])), 'Look at the last digit.');
    return { text: 'Which of these numbers is ' + want + '?', choices: shown, answer: shown.indexOf(String(right)), expr: '(' + right + ' % 2 === ' + wantMod + ') ? ' + right + ' : -1', explain: right + ' is ' + want + '.',
      how: 'Even numbers end in 0, 2, 4, 6 or 8. Odd numbers end in 1, 3, 5, 7 or 9. ' + right + ' ends in ' + (right % 10) + ', so it is ' + want + '.', why };
  }
  const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
  function placeValue(count) {
    const digs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count), n = digs.join(''), idx = int(0, count - 1), d = digs[idx], pos = count - 1 - idx, val = d * Math.pow(10, pos);
    const others = []; for (let k = 0; k <= Math.max(count, 3); k++) if (k !== pos) others.push(k);
    const picks = shuffle(others).slice(0, 3), vals = picks.map((k) => d * Math.pow(10, k)), shown = shuffle([val, ...vals]).map(String);
    const why = whyFor(shown, String(val), Object.fromEntries(picks.map((k, i) => [String(vals[i]), 'That is the value of the ' + d + ' in the ' + PLACE[k] + ' place. Count places from the right.'])), 'Count places from the right.');
    return { text: 'What is the value of the ' + d + ' in ' + n + '?', choices: shown, answer: shown.indexOf(String(val)), expr: d + ' * ' + Math.pow(10, pos), explain: 'The ' + d + ' is in the ' + PLACE[pos] + ' place.',
      how: 'Count places from the right: ones, tens, hundreds... The ' + d + ' is in the ' + PLACE[pos] + ' place, so its value is ' + d + ' ' + TIMES + ' ' + Math.pow(10, pos) + ' = ' + val + '.', why };
  }
  function rounding(place) {
    let n; do { n = place === 10 ? int(11, 99) : place === 100 ? int(101, 999) : int(1001, 9999); } while (n % place === 0);
    const ans = Math.round(n / place) * place, down = Math.floor(n / place) * place, up = down + place, other = ans === down ? up : down;
    const digit = Math.floor((n % place) / (place / 10)), cand = [other, ans + place, ans - place, Math.round(n / (place * 10)) * place * 10, ans + 2 * place, ans + 3 * place, ans + 4 * place].filter((v, i, a) => v > 0 && v !== ans && a.indexOf(v) === i);
    const picks = cand.slice(0, 3), shown = shuffle([ans, ...picks]).map(String);
    const why = whyFor(shown, String(ans), Object.fromEntries(picks.map((v) => [String(v), v === other ? 'That rounds the wrong way. Check the digit to the right.' : 'That is too far. Round to the nearest ' + place + '.'])), 'Round to the nearest ' + place + '.');
    return { text: 'Round ' + n + ' to the nearest ' + place + '.', choices: shown, answer: shown.indexOf(String(ans)), expr: 'Math.round(' + n + ' / ' + place + ') * ' + place, explain: n + ' rounds to ' + ans + '.',
      how: 'Look at the digit just to the right of the ' + PLACE[String(place).length - 1] + ' place: ' + digit + '. ' + (digit >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down') + ', so ' + n + ' becomes ' + ans + '.', why };
  }
  // Like numeric(), but the wrong choices come from realistic mistakes (`cands`, in any order) instead of always being
  // one or two away. If there are fewer than three, it tops up with steps of `step`.
  function fixed(text, value, expr, explain, cands, how, misses, step) {
    const wrong = shuffle([...new Set(cands)].filter((v) => Number.isInteger(v) && v >= 0 && v !== value)).slice(0, 3);
    for (let d = 1; wrong.length < 3; d++) for (const v of [value + d * (step || 1), value - d * (step || 1)]) if (wrong.length < 3 && v >= 0 && v !== value && !wrong.includes(v)) wrong.push(v);
    const why = {}; wrong.forEach((v) => { why[String(v)] = (misses && misses[v]) || nearMsg(v - value); });
    return finish(text, [value, ...wrong].map(String), String(value), expr, explain, how, why);
  }
  function money(level) {    const kinds = [['penny', 'pennies', 1], ['nickel', 'nickels', 5], ['dime', 'dimes', 10], ['quarter', 'quarters', 25]], use = level === 1 ? [kinds[2], kinds[0]] : level === 2 ? [kinds[3], kinds[2], kinds[1]] : shuffle(kinds.slice()).slice(0, 3);
    const parts = use.map((k) => ({ n: int(1, level === 1 ? 4 : 5), k })), name = pick(NAMES), total = parts.reduce((s, p) => s + p.n * p.k[2], 0), coins = parts.reduce((s, p) => s + p.n, 0);
    const list = parts.map((p) => plural(p.n, p.k[0], p.k[1])), text = name + ' has ' + (list.length > 2 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join(' and ')) + '. How many cents is that?';
    return fixed(text, total, parts.map((p) => p.n + '*' + p.k[2]).join(' + '), 'Together that is ' + total + ' cents.', [coins, total + 5, total - 5, total + 10, total - 10, total + 25],
      parts.map((p) => p.n + ' ' + p.k[1] + ' ' + TIMES + ' ' + p.k[2] + ' = ' + (p.n * p.k[2])).join('; ') + '. Add: ' + parts.map((p) => p.n * p.k[2]).join(' + ') + ' = ' + total + ' cents.',
      mk([[coins, 'That counts the coins. Add up what each coin is worth.'], [total + 5, 'A nickel too many. Recheck each coin\u2019s value.'], [total - 5, 'A nickel too few. Recheck each coin\u2019s value.']]), 5);
  }
  function timeAfter(level) {
    const h = int(1, 12), m = level === 1 ? pick([0, 30]) : pick([0, 15, 30, 45]), delta = level === 1 ? pick([30, 60]) : pick([15, 20, 45, 60, 75, 90]);
    const fmt = (t) => { t = ((t % 720) + 720) % 720; return (Math.floor(t / 60) % 12 || 12) + ':' + String(t % 60).padStart(2, '0'); };
    const start = (h % 12) * 60 + m, ans = fmt(start + delta), offs = shuffle([-60, 60, -15, 15, -30, 30, -10, 10]), wrong = [];
    for (const o of offs) { const v = fmt(start + delta + o); if (v !== ans && !wrong.includes(v) && wrong.length < 3) wrong.push(v); }
    const label = (o, v) => Math.abs(o) === 60 ? 'That is an hour off. Count the minutes again.' : 'That is ' + Math.abs(o) + ' minutes off. Count on carefully.';
    const shown = shuffle([ans, ...wrong]), why = {};
    wrong.forEach((v) => { const o = offs.find((x) => fmt(start + delta + x) === v); why[v] = label(o, v); });
    return { text: 'It is ' + h + ':' + String(m).padStart(2, '0') + '. What time is it ' + (delta === 60 ? '1 hour' : delta === 30 ? '30 minutes' : delta + ' minutes') + ' later?', choices: shown, answer: shown.indexOf(ans),
      expr: '(' + start + ' + ' + delta + ') % 720', explain: 'It will be ' + ans + '.',
      how: 'Count on ' + delta + ' minutes from ' + h + ':' + String(m).padStart(2, '0') + '. Every 60 minutes is one hour. That makes ' + ans + '.', why };
  }
  function areaPerimeter(maxSide) {
    const l = int(3, maxSide), w = int(2, l), area = R.r() < 0.5, A = l * w, P = 2 * (l + w), ans = area ? A : P;
    return fixed('A rectangle is ' + l + ' cm long and ' + w + ' cm wide. ' + (area ? 'What is its area in square cm?' : 'How far is it around the outside (its perimeter) in cm?'), ans, area ? l + ' * ' + w : '2 * (' + l + ' + ' + w + ')', area ? 'Area is length times width.' : 'Perimeter is all four sides added up.',
      area ? [P, l + w, A + l, A - l, A + w] : [A, l + w, 2 * l + w, P + 2, P - 2],
      area ? 'Area covers the inside: length ' + TIMES + ' width. ' + l + ' ' + TIMES + ' ' + w + ' = ' + A + '.' : 'Add all four sides: ' + l + ' + ' + w + ' + ' + l + ' + ' + w + ' = ' + P + '.',
      mk(area ? [[P, 'That is the distance around (perimeter). Area covers the inside: multiply.'], [l + w, 'That adds two sides. Area is length ' + TIMES + ' width.'], [A + l, 'One row too many. Multiply ' + l + ' ' + TIMES + ' ' + w + ' exactly.'], [A - l, 'One row too few. Multiply ' + l + ' ' + TIMES + ' ' + w + ' exactly.'], [A + w, 'One row too many. Multiply ' + l + ' ' + TIMES + ' ' + w + ' exactly.']]
        : [[A, 'That is the area. Perimeter is the distance around: add the sides.'], [l + w, 'That is only two sides. A rectangle has four.'], [2 * l + w, 'That counts one of the short sides only once. There are two of each.']]), 2);
  }
  function percentOf() {
    const pct = pick([10, 20, 25, 50, 75]), base = 20 * int(1, 10), ans = base * pct / 100, left = base - ans;
    const how = { 50: '50% is half: ' + base + ' ' + DIVIDE + ' 2 = ' + ans + '.', 25: '25% is a quarter: ' + base + ' ' + DIVIDE + ' 4 = ' + ans + '.', 10: '10% is one tenth: ' + base + ' ' + DIVIDE + ' 10 = ' + ans + '.', 20: '20% is one fifth: ' + base + ' ' + DIVIDE + ' 5 = ' + ans + '.', 75: '75% is three quarters: ' + base + ' ' + DIVIDE + ' 4 = ' + (base / 4) + ', then ' + TIMES + ' 3 = ' + ans + '.' }[pct];
    return fixed('What is ' + pct + '% of ' + base + '?', ans, pct + ' / 100 * ' + base, pct + '% of ' + base + ' is ' + ans + '.', [pct, left, ans * 2, ans / 2, ans + 10, ans - 10], how,
      mk([[pct, 'That is the percent itself, not the amount.'], [left, 'That is what is left over. You want ' + pct + '% of ' + base + '.'], [ans * 2, 'That is double. Check the fraction that ' + pct + '% stands for.'], [ans / 2, 'That is half of the answer. Check the fraction that ' + pct + '% stands for.'], [ans + 10, 'Ten too many. Divide carefully.'], [ans - 10, 'Ten too few. Divide carefully.']]), 5);
  }  function meanOf() {
    const n = int(3, 5), m = int(3, 12); let nums;
    for (;;) { nums = []; for (let i = 0; i < n - 1; i++) nums.push(int(1, 2 * m)); const last = n * m - nums.reduce((a, b) => a + b, 0); if (last >= 1 && last <= 2 * m + 3) { nums.push(last); break; } }
    nums = shuffle(nums); const sum = n * m, sorted = nums.slice().sort((a, b) => a - b), mid = sorted[Math.floor(n / 2)];
    const misses = [[sum, 'That is the total. Share it equally: divide by ' + n + '.']]; if (mid !== m) misses.push([mid, 'That is the middle number. The mean shares the total equally.']);
    return numeric('What is the mean (average) of ' + nums.join(', ') + '?', m, '(' + nums.join(' + ') + ') / ' + n, 'The mean is ' + m + '.', [sum, mid], 'Add them up: ' + nums.join(' + ') + ' = ' + sum + '. Share equally among ' + n + ': ' + sum + ' ' + DIVIDE + ' ' + n + ' = ' + m + '.', mk(misses));
  }
  function multipleOf(lo, hi) {
    const k = int(lo, hi), mult = int(3, 11), ans = k * mult, cand = shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans + k - 1, ans - k + 1, ans + 3].filter((v, i, arr) => v > 0 && v % k !== 0 && arr.indexOf(v) === i)).slice(0, 3);
    const shown = shuffle([ans, ...cand]).map(String), why = whyFor(shown, String(ans), Object.fromEntries(cand.map((v) => [String(v), v + ' ' + DIVIDE + ' ' + k + ' leaves a remainder of ' + (v % k) + ', so it is not a multiple.'])), 'Check it against the ' + k + ' times table.');
    return { text: 'Which number is a multiple of ' + k + '?', choices: shown, answer: shown.indexOf(String(ans)), expr: '(' + ans + ' % ' + k + ' === 0) ? ' + ans + ' : -1', explain: ans + ' is in the ' + k + ' times table.',
      how: 'Multiples of ' + k + ' are in the ' + k + ' times table: ' + k + ' ' + TIMES + ' ' + mult + ' = ' + ans + ', so ' + ans + ' works.', why };
  }
  function unitConvert(tier) {
    const table = tier === 1 ? [['hours', 'hour', 'minutes', 60], ['minutes', 'minute', 'seconds', 60], ['feet', 'foot', 'inches', 12]] : [['meters', 'meter', 'centimeters', 100], ['kilometers', 'kilometer', 'meters', 1000], ['kilograms', 'kilogram', 'grams', 1000], ['liters', 'liter', 'milliliters', 1000]];
    const [a, sing, b, f] = pick(table), n = int(2, 9), val = n * f;
    return fixed(n + ' ' + a + ' = ? ' + b, val, n + ' * ' + f, n + ' ' + a + ' is ' + val + ' ' + b + '.', [val / 10, val * 10, n + f, val + f, val - f], '1 ' + sing + ' is ' + f + ' ' + b + ', so ' + n + ' ' + TIMES + ' ' + f + ' = ' + val + '.',
      mk([[val / 10, 'Too small. 1 ' + sing + ' is ' + f + ' ' + b + ', not ' + (f / 10) + '.'], [val * 10, 'Too big. 1 ' + sing + ' is ' + f + ' ' + b + ', not ' + (f * 10) + '.'], [n + f, 'That adds. Multiply by ' + f + '.'], [val + f, 'One ' + sing + ' too many. Multiply ' + n + ' ' + TIMES + ' ' + f + ' exactly.'], [val - f, 'One ' + sing + ' too few. Multiply ' + n + ' ' + TIMES + ' ' + f + ' exactly.']]), f >= 100 ? 50 : 6);
  }  function simplifyFraction() {
    let n, d; do { d = int(3, 9); n = int(1, d - 1); } while (gcd(n, d) !== 1);
    const k = int(2, 4), ans = n + '/' + d, pool = [n + '/' + (d * k), (n * k) + '/' + d, (n + 1) + '/' + d, n + '/' + (d + 1), (n + 2) + '/' + d].filter((v, i, a) => a.indexOf(v) === i && v !== ans);
    const picks = pool.slice(0, 3), shown = shuffle([ans, ...picks]);
    const why = whyFor(shown, ans, { [n + '/' + (d * k)]: 'You divided only the top. Divide the bottom by ' + k + ' too.', [(n * k) + '/' + d]: 'You divided only the bottom. Divide the top by ' + k + ' too.' }, 'Divide the top and the bottom by the same number.');
    return { text: 'Simplify ' + (n * k) + '/' + (d * k) + '.', choices: shown, answer: shown.indexOf(ans), expr: n + '/' + d, explain: (n * k) + '/' + (d * k) + ' simplifies to ' + ans + '.',
      how: 'Divide the top and the bottom by the same number, ' + k + ': ' + (n * k) + ' ' + DIVIDE + ' ' + k + ' = ' + n + ' and ' + (d * k) + ' ' + DIVIDE + ' ' + k + ' = ' + d + '. So ' + ans + '.', why };
  }
  function twoStepWord(maxA, maxB) {
    const nm = pick(NAMES), t = pick(THINGS), a = int(2, maxA), b = int(3, maxB), P = a * b, add = R.r() < 0.5, c = add ? int(2, 15) : int(2, Math.min(15, P - 1)), ans = add ? P + c : P - c;
    return fixed(nm + ' has ' + a + ' bags with ' + b + ' ' + t + ' in each. ' + (add ? 'Then ' + nm + ' finds ' + c + ' more.' : nm + ' gives away ' + c + '.') + ' How many ' + t + (add ? ' now?' : ' are left?'), ans, a + ' * ' + b + (add ? ' + ' : ' - ') + c, 'Two steps: multiply, then ' + (add ? 'add.' : 'take away.'), [P, add ? P - c : P + c, a + b + (add ? c : -c), ans + b, ans - b],
      'Step 1: ' + a + ' bags of ' + b + ' is ' + a + ' ' + TIMES + ' ' + b + ' = ' + P + '. Step 2: ' + P + (add ? ' + ' : ' ' + MINUS + ' ') + c + ' = ' + ans + '.',
      mk([[P, 'That is only step 1. Now ' + (add ? 'add ' : 'take away ') + c + '.'], [add ? P - c : P + c, 'Wrong way round: ' + nm + (add ? ' finds more, so add.' : ' gives some away, so take away.')], [ans + b, 'One bag too many. Multiply ' + a + ' ' + TIMES + ' ' + b + ' exactly.'], [ans - b, 'One bag too few. Multiply ' + a + ' ' + TIMES + ' ' + b + ' exactly.']]), 2);
  }
  // Each grade and level mixes the old core question with the new types. Weights are relative.
  const TABLE = {
    1: [
      weighted([[K('addSub', () => addSub(10)), 5], [K('missingAddend', () => missingAddend(10)), 2], [K('skipCount', () => skipCount(1)), 1], [K('evenOdd', () => evenOdd(20)), 1]]),
      weighted([[K('addSub', () => addSub(20, 5)), 4], [K('missingAddend', () => missingAddend(20)), 2], [K('compareNumbers', () => compareNumbers(2)), 1], [K('skipCount', () => skipCount(1)), 1], [K('money', () => money(1)), 1]]),
      weighted([[K('wordAddSub', () => wordAddSub(20)), 4], [K('money', () => money(1)), 1], [K('timeAfter', () => timeAfter(1)), 1], [K('missingAddend', () => missingAddend(20)), 1]]),
    ],
    2: [
      weighted([[K('addSub', () => addSub(50, 10)), 4], [K('missingAddend', () => missingAddend(50)), 2], [K('placeValue', () => placeValue(2)), 1], [K('compareNumbers', () => compareNumbers(2)), 1], [K('evenOdd', () => evenOdd(60)), 1]]),
      weighted([[K('addSub', () => addSub(100, 20)), 3], [K('mult', () => mult(10, 10, 2)), 2], [K('skipCount', () => skipCount(2)), 1], [K('placeValue', () => placeValue(3)), 1], [K('rounding', () => rounding(10)), 1], [K('money', () => money(2)), 1]]),
      weighted([[K('wordAddSub', () => wordAddSub(100)), 2], [K('wordGroups', () => wordGroups(5, 10)), 2], [K('timeAfter', () => timeAfter(2)), 1], [K('money', () => money(2)), 1], [K('missingFactor', () => missingFactor(5, 5)), 1]]),
    ],
    3: [
      weighted([[K('mult', () => mult(5, 5)), 4], [K('missingFactor', () => missingFactor(5, 5)), 2], [K('skipCount', () => skipCount(3)), 1], [K('rounding', () => rounding(10)), 1]]),
      weighted([[K('mult', () => mult(10, 10)), 3], [K('div', () => div(10, 10)), 3], [K('missingFactor', () => missingFactor(10, 10)), 2], [K('placeValue', () => placeValue(3)), 1], [K('rounding', () => rounding(100)), 1]]),
      weighted([[K('wordGroups', () => wordGroups(9, 10)), 3], [K('areaPerimeter', () => areaPerimeter(9)), 2], [K('timeAfter', () => timeAfter(2)), 1], [K('money', () => money(3)), 1], [K('twoStepWord', () => twoStepWord(5, 9)), 1]]),
    ],
    4: [
      weighted([[K('multiDigit', () => multiDigit()), 3], [K('mult', () => mult(12, 12)), 2], [K('placeValue', () => placeValue(4)), 1], [K('rounding', () => rounding(100)), 1], [K('unitConvert', () => unitConvert(1)), 1]]),
      weighted([[K('fractionEquivalent', () => fractionEquivalent()), 2], [K('fractionAddLike', () => fractionAddLike()), 2], [K('fractionCompare', () => fractionCompare()), 2], [K('simplifyFraction', () => simplifyFraction()), 2], [K('multipleOf', () => multipleOf(3, 9)), 1]]),
      weighted([[K('fractionOfSet', () => fractionOfSet()), 2], [K('wordGroups', () => wordGroups(9, 12)), 1], [K('multiDigit', () => multiDigit()), 1], [K('twoStepWord', () => twoStepWord(9, 12)), 2], [K('areaPerimeter', () => areaPerimeter(12)), 2], [K('rounding', () => rounding(1000)), 1]]),
    ],
    5: [
      weighted([[K('fractionAddUnlike', () => fractionAddUnlike()), 3], [K('fractionOfSet', () => fractionOfSet()), 2], [K('simplifyFraction', () => simplifyFraction()), 2], [K('percentOf', () => percentOf()), 2]]),
      weighted([[K('decimalAddSub', () => decimalAddSub()), 3], [K('decimalTimesTen', () => decimalTimesTen()), 2], [K('unitConvert', () => unitConvert(2)), 2], [K('meanOf', () => meanOf()), 2], [K('multipleOf', () => multipleOf(6, 12)), 1]]),
      weighted([[K('orderOfOps', () => orderOfOps()), 3], [K('decimalWord', () => decimalWord()), 2], [K('percentOf', () => percentOf()), 2], [K('twoStepWord', () => twoStepWord(12, 15)), 2], [K('meanOf', () => meanOf()), 1]]),
    ],
  };

  MQR.Math = {
    rng,
    GRADES: [1, 2, 3, 4, 5],
    TOPICS: { 1: 'Adding, subtracting, patterns and coins', 2: 'Place value, adding, times tables and time', 3: 'Multiplying, dividing, rounding and area', 4: 'Multiplying, fractions, factors and measures', 5: 'Fractions, decimals, percent and averages' },
    make(grade, level, random) {
      R.r = random || Math.random;
      const g = Math.max(1, Math.min(5, grade | 0)), l = Math.max(1, Math.min(3, level | 0));
      return TABLE[g][l - 1]();
    },
  };
})();