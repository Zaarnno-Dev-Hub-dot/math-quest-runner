// Generates 60,000 questions (5 grades x 3 levels x 4,000) and checks each one: exactly 4 unique choices, the marked answer
// equals an independent evaluation of the question's expression, and nothing is negative or unparseable.
// Also checks the wrong-answer hint: a worked solution that mentions the right answer, and a reason for every wrong choice.
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/math.js', 'utf8'), ctx);
const M = ctx.MQR.Math;
const parse = (s) => { if (/^\d{1,2}:\d{2}$/.test(s)) { const [h, m] = s.split(':').map(Number); return (h % 12) * 60 + m; } if (/^-?\d+\/\d+$/.test(s)) { const [a, b] = s.split('/').map(Number); return a / b; } return Number(s); };
let bad = 0; const report = []; const allKinds = {};
for (const g of [1, 2, 3, 4, 5]) for (const l of [1, 2, 3]) {
  const r = M.rng(g * 100 + l); const samples = new Set(); let maxV = 0; const kindsHere = {};
  for (let i = 0; i < 4000; i++) {
    const q = M.make(g, l, r); let why = null;
    if (!q.text || q.choices.length !== 4) why = 'shape';
    else if (new Set(q.choices).size !== 4) why = 'duplicate choices: ' + q.choices.join('|');
    else if (!(q.answer >= 0 && q.answer < 4)) why = 'bad answer index';
    else if (!q.how || !q.how.includes(q.choices[q.answer])) why = 'how missing or does not mention the answer: ' + q.text + ' | ' + q.how + ' | ans ' + q.choices[q.answer];
    else if (q.choices.some((c, i) => i !== q.answer && !(q.why && typeof q.why[c] === 'string' && q.why[c].length > 8))) why = 'missing why for a wrong choice: ' + q.text + ' | ' + q.choices.join('|') + ' | ' + JSON.stringify(q.why);
    else if (q.how.length > 240) why = 'how too long for the card (' + q.how.length + '): ' + q.how;
    else if (/NaN|undefined|Infinity|null/.test(q.text + q.how + q.explain + JSON.stringify(q.why) + q.choices.join('|'))) why = 'bad text: ' + q.text + ' | ' + q.how + ' | ' + JSON.stringify(q.why);
    else if (!q.kind) why = 'question has no kind';
    else {
      const real = Function('return (' + q.expr + ')')(); const chosen = parse(q.choices[q.answer]);
      if (!isFinite(chosen) || Math.abs(real - chosen) > 1e-9) why = 'wrong answer: ' + q.text + ' expr=' + q.expr + ' real=' + real + ' chose=' + q.choices[q.answer];
      if (q.choices.some((c) => !isFinite(parse(c)) && !/^(they are equal|cannot tell)$/.test(c) && !/^\d+\/\d+$/.test(c))) why = why || 'unparseable choice: ' + q.choices.join('|');
      if (q.choices.some((c) => parse(c) < 0)) why = why || 'negative choice: ' + q.choices.join('|');
    }
    if (why) { bad++; if (bad <= 8) console.log('PROBLEM g' + g + ' l' + l + ':', why); }
    if (q.kind) { allKinds[q.kind] = (allKinds[q.kind] || 0) + 1; (kindsHere[q.kind] = (kindsHere[q.kind] || 0) + 1); }
    samples.add(q.text); maxV = Math.max(maxV, ...q.choices.map(parse).filter(isFinite));
  }
  if (Object.keys(kindsHere).length < 3) { bad++; console.log('PROBLEM g' + g + ' l' + l + ': only ' + Object.keys(kindsHere).join(',')); }
  report.push(`g${g} L${l} [${Object.keys(kindsHere).length} kinds]: ${samples.size} distinct of 4000, max value ${Math.round(maxV*100)/100}, e.g. "${[...samples][0]}"`);
}
console.log(report.join('\n'));
const kindNames = Object.keys(allKinds).sort(); console.log('question kinds (' + kindNames.length + '): ' + kindNames.map((k) => k + ' ' + allKinds[k]).join(', '));
if (kindNames.length < 28) { bad++; console.log('PROBLEM: expected at least 28 question kinds, got ' + kindNames.length); }
console.log('problems:', bad);
process.exit(bad ? 1 : 0);
