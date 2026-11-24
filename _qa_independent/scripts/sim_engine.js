// Independent QA: engine-level Monte Carlo (does NOT modify business code)
const path = require('path');
const base = path.resolve(__dirname, '../../js');
const CFG = require(path.join(base, 'config.js'));
const Q = require(path.join(base, 'questions.js'));
const A = require(path.join(base, 'archetypes.js'));
const E = require(path.join(base, 'engine.js'));
const QM = Object.fromEntries(Q.map(q => [q.id, q]));

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function run(anchor, att, rec, pick) {
  const s1 = E.buildStage1Queue(Q, anchor, att, rec);
  const ans = [];
  for (let k = 0; k < 40; k++) {
    const st = E.selectNextOrStop(ans, s1, Q, anchor, att, rec);
    if (st.stop) break;
    const q = st.nextItem;
    ans.push({ item: q, selectedIndex: pick(q, ans.length) });
  }
  return { ans, rep: E.evaluateQuiz(ans) };
}
function dist(arr) { const o = {}; arr.forEach(x => o[x] = (o[x] || 0) + 1); return Object.fromEntries(Object.entries(o).sort()); }
function pct(o, n) { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (100 * v / n).toFixed(1) + '%'])); }

const out = {};
// 1) Uniform random responders
{
  const N = 5000, r = lcg(20261125), cnt = [], prim = [], ssr = [];
  for (let i = 0; i < N; i++) {
    const { rep } = run('ANON-SIM' + i, 1, new Set(), () => Math.floor(r() * 4));
    cnt.push(rep.answeredCount); prim.push(rep.primaryArchetype.id); ssr.push(rep.isSsrVariant ? 1 : 0);
  }
  out.uniformRandom = { N, askedDist: dist(cnt), mean: (cnt.reduce((a, b) => a + b, 0) / N).toFixed(2), primaryPct: pct(dist(prim), N), ssrRate: (100 * ssr.reduce((a, b) => a + b, 0) / N).toFixed(1) + '%' };
}
// 2) Fixed-letter responders
{
  const res = {};
  for (const L of [0, 1, 2, 3]) {
    const prim = [], cnt = [];
    for (let i = 0; i < 300; i++) { const { rep } = run('ANON-FIX' + i, 1, new Set(), () => L); prim.push(rep.primaryArchetype.id); cnt.push(rep.answeredCount); }
    res['ABCD'[L]] = { primaryPct: pct(dist(prim), 300), askedDist: dist(cnt) };
  }
  out.fixedLetter = res;
}
// 3) Latent-trait softmax model (spec §6.1: theta~N(0,I), beta=0.52, weights de-scaled * sqrt(scale))
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
{
  const N = 5000, r = lcg(777), prim = [], cnt = [], hit = [];
  const unitA = A.map(a => { const n = Math.hypot(...a.vector); return { id: a.id, u: a.vector.map(x => x / n) }; });
  for (let i = 0; i < N; i++) {
    const th = [gauss(r), gauss(r), gauss(r), gauss(r)];
    const pick = q => {
      const ex = q.options.map(o => Math.exp(0.52 * o.weights.reduce((s, w, d) => s + (q.scales[d] ? (w / q.scales[d]) * Math.sqrt(q.scales[d]) : 0) * th[d], 0)));
      const S = ex.reduce((a, b) => a + b, 0); let x = r() * S; for (let k = 0; k < 4; k++) { x -= ex[k]; if (x <= 0) return k; } return 3;
    };
    const { rep } = run('ANON-LAT' + i, 1, new Set(), pick);
    prim.push(rep.primaryArchetype.id); cnt.push(rep.answeredCount);
    // "true" archetype = nearest by cosine of 54+17*theta
    const tv = th.map(t => 54.17 + 17.2 * t).map(x => Math.max(1, x)); const tn = Math.hypot(...tv);
    const truth = unitA.map(a => ({ id: a.id, s: a.u.reduce((s, x, d) => s + x * tv[d] / tn, 0) })).sort((a, b) => b.s - a.s)[0].id;
    hit.push(truth === rep.primaryArchetype.id ? 1 : 0);
  }
  out.latentSoftmax = { N, askedDist: dist(cnt), mean: (cnt.reduce((a, b) => a + b, 0) / N).toFixed(2), primaryPct: pct(dist(prim), N), accuracyVsTruth: (100 * hit.reduce((a, b) => a + b, 0) / N).toFixed(1) + '%' };
}
// 4) Determinism: same anchor/att + same picks => same result
{
  const seq = (q, k) => (k * 7 + 3) % 4;
  const a = run('DM-KQX2-F2PY', 1, new Set(), seq).rep, b = run('DM-KQX2-F2PY', 1, new Set(), seq).rep;
  out.determinism = { run1: a.primaryArchetype.id, run2: b.primaryArchetype.id, same: a.primaryArchetype.id === b.primaryArchetype.id && JSON.stringify(a.scoresVec) === JSON.stringify(b.scoresVec) };
}
// 5) Content length specs (stem 55~85, option 25~38 chars)
{
  const len = s => Array.from(s).length;
  const badStem = Q.filter(q => len(q.stem) < 55 || len(q.stem) > 85).map(q => `${q.id}:${len(q.stem)}`);
  const badOpt = []; Q.forEach(q => q.options.forEach(o => { const l = len(o.text); if (l < 25 || l > 38) badOpt.push(`${q.id}${o.key}:${l}`); }));
  const optLens = Q.flatMap(q => q.options.map(o => len(o.text)));
  out.lengths = { stemOutOfSpec: badStem, optionOutOfSpecCount: badOpt.length, optionOutOfSpecSample: badOpt.slice(0, 30), optionMin: Math.min(...optLens), optionMax: Math.max(...optLens) };
}
// 6) Per-dimension signature vocabulary (transparency of keyed answer)
{
  const all = Q.filter(q => q.tier !== 'special');
  const words = ['闭环', '果断', '立刻', '拍板', '话术', '台阶', '体面', '逻辑', '精算', '测算', '底层', '降维', '冷冰冰', '冷酷', '不留情面', '暖心'];
  const byDim = {};
  for (const w of words) {
    const c = { V: 0, L: 0, Q: 0, D: 0, total: 0 };
    all.forEach(q => q.options.forEach(o => { if (o.text.includes(w)) { const d = o.weights.indexOf(Math.max(...o.weights)); c['VLQD'[d]]++; c.total++; } }));
    byDim[w] = c;
  }
  out.signatureVocab = byDim;
}
console.log(JSON.stringify(out, null, 1));
