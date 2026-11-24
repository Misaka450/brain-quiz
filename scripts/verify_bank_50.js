#!/usr/bin/env node
/* 《大脑出厂设置测评》v1.5 自动化全链路硬验收脚本（Node.js 零依赖直跑）
 * 严格覆盖 impl_plan_v2_50q.md §7.4 全部 7 条硬断言 + 20 组随机作答分布 + 双端 HMAC + 合规词扫描
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SITE_DIR = path.resolve(__dirname, '..');
const CONFIG = require(path.join(SITE_DIR, 'js/config.js'));
const QUESTIONS = require(path.join(SITE_DIR, 'js/questions.js'));
const ARCHETYPES = require(path.join(SITE_DIR, 'js/archetypes.js'));
const Auth = require(path.join(SITE_DIR, 'js/auth.js'));
const Engine = require(path.join(SITE_DIR, 'js/engine.js'));

let failed = 0;
function assert(cond, label, detail) {
  if (cond) {
    console.log(`[PASS] ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    console.error(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  }
}

/* ===== 1. 容量与分层断言 ===== */
const coreQs = QUESTIONS.filter(q => q.tier === 'core');
const pairQs = QUESTIONS.filter(q => q.tier === 'pair');
const specQs = QUESTIONS.filter(q => q.tier === 'special');
const pairCounts = { VL: 0, VQ: 0, VD: 0, LQ: 0, LD: 0, QD: 0 };
pairQs.forEach(q => { pairCounts[q.pairTag] = (pairCounts[q.pairTag] || 0) + 1; });
const idSet = new Set(QUESTIONS.map(q => q.id));
const stemSet = new Set(QUESTIONS.map(q => q.stem.trim()));
const optTexts = QUESTIONS.flatMap(q => q.options.map(o => o.text.trim()));
const hasEmpty = QUESTIONS.some(q => !q.stem.trim() || q.options.length !== 4 || q.options.some(o => !o.text.trim()));
const pairAll4 = Object.values(pairCounts).every(c => c === 4);

assert(
  QUESTIONS.length === 50 && coreQs.length === 24 && pairQs.length === 24 && specQs.length === 2 &&
  pairAll4 && idSet.size === 50 && stemSet.size === 50 && new Set(optTexts).size === 200 && !hasEmpty,
  '断言 1 · 容量与分层完整性',
  `total=${QUESTIONS.length}, core=${coreQs.length}, pair=${pairQs.length}, special=${specQs.length}, buckets=${JSON.stringify(pairCounts)}, uniqueStems=${stemSet.size}, uniqueOpts=${new Set(optTexts).size}`
);

/* ===== 2. 单题正交与行和断言 ===== */
const orthQs = QUESTIONS.filter(q => q.tier !== 'special');
let singleOrthOk = true;
let coreRowSumOk = true;
for (const q of orthQs) {
  const W = q.options.map(o => o.weights);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const dot = W.reduce((s, r) => s + r[i] * r[j], 0);
      const exp = i === j ? 25 * q.scales[i] * q.scales[i] : 0;
      if (dot !== exp) singleOrthOk = false;
    }
  }
  if (q.tier === 'core') {
    for (const r of W) {
      if (r[0] + r[1] + r[2] + r[3] !== 5) coreRowSumOk = false;
    }
  }
}
assert(singleOrthOk && coreRowSumOk, '断言 2 · 48道正交题单题 W^T W=25*diag(s^2) 与 Tier A 行和=+5', `singleOrth=${singleOrthOk}, coreRowSum=${coreRowSumOk}`);

/* ===== 3. 12 块矩阵与 S4 唯一性断言 ===== */
const coreMatSet = new Set(coreQs.map(q => JSON.stringify(q.options.map(o => o.weights))));
const orthMatSet = new Set(orthQs.map(q => JSON.stringify(q.options.map(o => o.weights))));
let blocksOk = true;
for (let b = 0; b < 12; b++) {
  const bq = orthQs.filter(q => q.blockId === b);
  if (bq.length !== 4) { blocksOk = false; continue; }
  const rows = bq.flatMap(q => q.options.map(o => o.weights));
  const sc = bq[0].scales;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const dot = rows.reduce((s, r) => s + r[i] * r[j], 0);
      const exp = i === j ? 100 * sc[i] * sc[i] : 0;
      if (dot !== exp) blocksOk = false;
    }
  }
}
const allRows = QUESTIONS.flatMap(q => q.options.map(o => o.weights));
let g50Ok = true;
const g50Diag = [];
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < 4; j++) {
    const dot = allRows.reduce((s, r) => s + r[i] * r[j], 0);
    if (i === j) g50Diag.push(dot);
    if (dot !== (i === j ? 2100 : 0)) g50Ok = false;
  }
}
assert(
  coreMatSet.size === 24 && orthMatSet.size === 48 && blocksOk && g50Ok,
  '断言 3 · 12 块格拉姆矩阵、S4 唯一性与 W50^T W50=2100 I_4',
  `S4_unique=${coreMatSet.size}/24, orth_unique=${orthMatSet.size}/48, W50_diag=[${g50Diag.join(',')}]`
);

/* ===== 4. 特种题零污染断言 ===== */
const metaExpect = ['LEVER', 'REBEL', 'SHADOW', 'SHIELD'].join(',');
const specClean = specQs.every(q =>
  q.scales.every(x => x === 0) &&
  q.options.every(o => o.weights.every(w => w === 0)) &&
  q.options.map(o => o.metaCode).slice().sort().join(',') === metaExpect
);
const sampleOrth = orthQs.slice(0, 15).map((item, idx) => ({ item, selectedIndex: idx % 4 }));
const baseU = Engine.computeNormalizedScores(sampleOrth);
let maxDiff = 0;
for (const sq of specQs) {
  for (let optIdx = 0; optIdx < 4; optIdx++) {
    const withS = Engine.computeNormalizedScores(sampleOrth.concat([{ item: sq, selectedIndex: optIdx }]));
    for (let d = 0; d < 4; d++) maxDiff = Math.max(maxDiff, Math.abs(withS[d] - baseU[d]));
  }
}
assert(specClean && maxDiff < 1e-12, '断言 4 · 特种题零缩放正交隔离与零污染', `clean=${specClean}, maxScoreDiff=${maxDiff}`);

/* ===== 5. 盲选防偏倚断言（100 种子 × 4 固定字母） ===== */
let blindStage1MaxErr = 0;
let blindMinFinal = Infinity;
let blindMaxFinal = -Infinity;
for (let seedIdx = 0; seedIdx < 100; seedIdx++) {
  const anchor = `BLIND-SEED-${seedIdx}`;
  const q1 = Engine.buildStage1Queue(QUESTIONS, anchor, 1, new Set());
  for (let letter = 0; letter < 4; letter++) {
    const answered = [];
    while (true) {
      const step = Engine.selectNextOrStop(answered, q1, QUESTIONS, anchor, 1, new Set());
      if (step.stop) break;
      answered.push({ item: step.nextItem, selectedIndex: letter });
      if (answered.length === 4 || answered.length === 8) {
        const uMid = Engine.computeNormalizedScores(answered);
        for (let d = 0; d < 4; d++) {
          blindStage1MaxErr = Math.max(blindStage1MaxErr, Math.abs(uMid[d] - 54.1666667));
        }
      }
    }
    const uEnd = Engine.computeNormalizedScores(answered);
    for (let d = 0; d < 4; d++) {
      blindMinFinal = Math.min(blindMinFinal, uEnd[d]);
      blindMaxFinal = Math.max(blindMaxFinal, uEnd[d]);
    }
  }
}
assert(
  blindStage1MaxErr < 1e-4 && blindMinFinal >= 46.5 && blindMaxFinal <= 61.0,
  '断言 5 · 盲选防偏倚（100 种子 × A/B/C/D 全固定死点）',
  `Q4/Q8_maxErr=${blindStage1MaxErr.toFixed(7)}, finalRange=[${blindMinFinal.toFixed(2)}, ${blindMaxFinal.toFixed(2)}]`
);

/* ===== 6. 二刷/三刷避重与题量边界断言（500 模拟用户 × 3 轮） ===== */
function simulateRun(anchorKey, attemptIndex, recentIdSet, rng) {
  const stage1 = Engine.buildStage1Queue(QUESTIONS, anchorKey, attemptIndex, recentIdSet);
  const answered = [];
  while (true) {
    const step = Engine.selectNextOrStop(answered, stage1, QUESTIONS, anchorKey, attemptIndex, recentIdSet);
    if (step.stop) break;
    const choice = Math.floor(rng() * 4);
    answered.push({ item: step.nextItem, selectedIndex: choice });
    if (answered.length > 25) throw new Error('Infinite loop detected');
  }
  return answered;
}

const simRng = Engine.mulberry32(20261124);
let minAsked = Infinity, maxAsked = 0, totalAsked = 0, runCount = 0;
let lastSpecialAll = true;
let stage1OverlapSum = 0;
let finaleOverlap12Sum = 0;
const histCounts = { 16: 0, 17: 0, 18: 0, 19: 0, 20: 0 };

for (let u = 0; u < 500; u++) {
  const anchor = `SIM-USER-${u}`;
  const recentRuns = [];
  const stage1Sets = [];
  const finaleIds = [];
  for (let att = 1; att <= 3; att++) {
    const recentSet = new Set(recentRuns.flat());
    const ans = simulateRun(anchor, att, recentSet, simRng);
    const n = ans.length;
    minAsked = Math.min(minAsked, n);
    maxAsked = Math.max(maxAsked, n);
    totalAsked += n;
    runCount++;
    histCounts[n] = (histCounts[n] || 0) + 1;
    if (ans[ans.length - 1].item.tier !== 'special') lastSpecialAll = false;

    const s1 = new Set(ans.slice(0, 8).map(x => x.item.id));
    stage1Sets.push(s1);
    finaleIds.push(ans[ans.length - 1].item.id);

    recentRuns.push(ans.map(x => x.item.id));
    if (recentRuns.length > CONFIG.RECENT_RUN_WINDOW) recentRuns.shift();
  }
  // 检查 1-2, 2-3, 1-3 之间 Stage 1 重合数必须全为 0
  for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
    for (const id of stage1Sets[a]) if (stage1Sets[b].has(id)) stage1OverlapSum++;
  }
  if (finaleIds[0] === finaleIds[1]) finaleOverlap12Sum++;
}
assert(
  minAsked >= 16 && maxAsked <= 20 && lastSpecialAll && stage1OverlapSum === 0 && finaleOverlap12Sum === 0,
  '断言 6 · 500 用户 × 3 轮避重与题量区间 [16, 20]',
  `range=[${minAsked},${maxAsked}], mean=${(totalAsked / runCount).toFixed(2)}, dist=${JSON.stringify(histCounts)}, stage1Overlaps=${stage1OverlapSum}, finale12Overlaps=${finaleOverlap12Sum}`
);

/* ===== 额外专项 1：20 组随机作答实答题数分布 ===== */
const rng20 = Engine.mulberry32(987654321);
const counts20 = [];
for (let i = 0; i < 20; i++) {
  const ans = simulateRun(`RAND20-${i}`, 1, new Set(), rng20);
  counts20.push(ans.length);
}
const all20Valid = counts20.every(n => n >= 16 && n <= 20);
assert(all20Valid, '专项检查 · 20 组随机作答实答题数全部落在 16–20', `counts=[${counts20.join(', ')}]`);

/* ===== 额外专项 2：确定性（同答案序列两次运行结果完全一致） ===== */
const detChoices = [0, 2, 1, 3, 1, 0, 2, 2, 3, 1, 0, 1, 2, 3, 0, 1, 2, 0, 3, 1];
function runDet(anchor) {
  const s1 = Engine.buildStage1Queue(QUESTIONS, anchor, 1, new Set());
  const ans = [];
  let idx = 0;
  while (true) {
    const step = Engine.selectNextOrStop(ans, s1, QUESTIONS, anchor, 1, new Set());
    if (step.stop) break;
    ans.push({ item: step.nextItem, selectedIndex: detChoices[idx++ % detChoices.length] });
  }
  return { qIds: ans.map(x => x.item.id), report: Engine.evaluateQuiz(ans) };
}
const rA = runDet('DM-TEST-ZXZZ');
const rB = runDet('DM-TEST-ZXZZ');
const detPass =
  JSON.stringify(rA.qIds) === JSON.stringify(rB.qIds) &&
  rA.report.primaryArchetype.id === rB.report.primaryArchetype.id &&
  rA.report.secondaryArchetype.id === rB.report.secondaryArchetype.id &&
  rA.report.metaCode === rB.report.metaCode &&
  JSON.stringify(rA.report.scoresVec) === JSON.stringify(rB.report.scoresVec);
assert(
  detPass,
  '专项检查 · 确定性验算（同一答案序列双跑）',
  `primary=${rA.report.primaryArchetype.id} (${rA.report.primaryArchetype.title}), secondary=${rA.report.secondaryArchetype.id}, meta=${rA.report.metaCode}, asked=${rA.qIds.length}`
);

/* ===== 额外专项 3：HMAC 基准向量校验 ===== */
const vectors = [
  ['DM-TEST-ZXZZ', true, 'OK'],
  ['s1 8k9p yknf', true, 'OK'],
  ['B3-7H4N-PM4V', true, 'OK'],
  ['CP-5X2L-RSGB', true, 'OK'],
  ['S1-8K9P-AAAA', false, 'BAD_MAC'],
  ['S1-8K90-YKNF', false, 'INVALID_CHAR']
];
const vecOk = vectors.every(([raw, expV, expR]) => {
  const res = Auth.verifyLocalHmac(raw);
  return res.valid === expV && res.reason === expR;
});
assert(vecOk, '专项检查 · JS 端 HMAC 基准向量 6/6 对拍');

/* ===== 7. 体积预算与合规禁词扫描 ===== */
const coreStaticFiles = [
  'index.html', 'css/main.css',
  'js/config.js', 'js/questions.js', 'js/archetypes.js',
  'js/auth.js', 'js/engine.js', 'js/tracker.js', 'js/poster.js', 'js/app.js'
];
const allHtmlJsCss = coreStaticFiles.concat(['claim.html']);
let rawTotal = 0;
let gzipTotal = 0;
let brotliTotal = 0;
let rawWithClaim = 0;
let gzipWithClaim = 0;
const forbiddenRe = /(算命|占卜|正缘|前世|改运|转运|破劫|天机|大师批断|塔罗|八字|星盘|宿命|轮回|六爻|手相|面相|抑郁|SCL-90|MMPI|人格障碍|心理疾病|心理治疗)/g;
const complianceHits = [];

for (const rel of allHtmlJsCss) {
  const full = path.join(SITE_DIR, rel);
  const buf = fs.readFileSync(full);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  const br = zlib.brotliCompressSync(buf).length;
  rawWithClaim += buf.length;
  gzipWithClaim += gz;
  if (rel !== 'claim.html') {
    rawTotal += buf.length;
    gzipTotal += gz;
    brotliTotal += br;
  }
  const text = buf.toString('utf8');
  const matches = text.match(forbiddenRe);
  if (matches) complianceHits.push({ file: rel, matches: Array.from(new Set(matches)) });
}

const sizeOk = rawTotal < 110 * 1024 && brotliTotal < 45 * 1024 && gzipTotal < 60 * 1024;
assert(
  sizeOk && complianceHits.length === 0,
  '断言 7 · 主站静态资源体积预算 (<110KB 原始 / <45KB Brotli / <60KB Gzip 红线) 与全站合规禁词清零',
  `coreRaw=${(rawTotal / 1024).toFixed(2)}KB, coreBrotli=${(brotliTotal / 1024).toFixed(2)}KB, coreGzip=${(gzipTotal / 1024).toFixed(2)}KB (含claim.html: ${(rawWithClaim / 1024).toFixed(2)}KB / ${(gzipWithClaim / 1024).toFixed(2)}KB), forbiddenHits=${complianceHits.length}`
);
if (complianceHits.length > 0) console.error('Forbidden hits:', complianceHits);

console.log('------------------------------------------------------------------------');
console.log(`VERIFY_BANK_50 SUMMARY: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
