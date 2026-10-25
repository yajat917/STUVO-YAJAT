// ─── scripts/check-ethics-content.mjs ──────────────────────────────────────
// Dev-only content check (NOT deployed, NOT in the service worker cache).
// Verifies that /lib/ethicsContent.js topics 1-32 match the guide source in
// scripts/ethics-source.txt (titles + bullets + table rows), that source
// bullets appear in the same order, and that the 10 Daily Student Self-Check
// items match. Exits non-zero on any mismatch.
import fs from 'fs';

const CONTENT_PATH = '/root/Stuvo-Git/stuvo/lib/ethicsContent.js';
const SOURCE_PATH = '/root/Stuvo-Git/stuvo/scripts/ethics-source.txt';

// Curly quotes/apostrophes -> straight; collapse whitespace; trim; lowercase;
// strip trailing periods.
function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
}

// Load the real data module by eval-ing it with a minimal `window` global.
globalThis.window = {};
const code = fs.readFileSync(CONTENT_PATH, 'utf8');
eval(code);
const parts = window.ETHICS_CONTENT || [];
const selfCheckData = window.ETHICS_SELF_CHECK || [];

if (!Array.isArray(parts) || parts.length === 0) {
  console.error('check-ethics-content: ETHICS_CONTENT not loaded');
  process.exit(1);
}

// Collect data topics 1-32.
const dataById = new Map(); // id -> {title, bullets:[], table|null}
let topicCount = 0;
let bulletCount = 0;
let tableRowCount = 0;
for (const part of parts) {
  if (!Array.isArray(part.topics)) continue;
  for (const topic of part.topics) {
    topicCount++;
    const bullets = (topic.bullets || []).map((b) =>
      typeof b === 'object' && b !== null ? b.text : b
    );
    bulletCount += bullets.length;
    let table = null;
    if (topic.table) {
      table = { headers: topic.table.headers, rows: topic.table.rows };
      tableRowCount += topic.table.rows.length;
    }
    dataById.set(topic.id, { title: topic.title, bullets, table });
  }
}

// ─── Parse the source text ────────────────────────────────────────────────
// Format:
//   Part N: Title          (9 parts)
//   N. Title               (topics 1-32)
//   bullet line            (one per line, under its topic)
//   Situation | ...        (topic 31 table header, then rows "A | B")
//   Daily Student Self-Check
//   10 plain lines
const srcText = fs.readFileSync(SOURCE_PATH, 'utf8');
const srcById = new Map(); // id -> {title, bullets:[], table:{headers,rows}|null}
let srcSelfCheck = [];
let partCount = 0;
let srcPartTitles = [];
let currentPart = null;
let currentTopic = null;
let inSelfCheck = false;

for (const rawLine of srcText.split('\n')) {
  const line = rawLine.trim();
  if (!line) continue;

  const mPart = line.match(/^Part\s+(\d+):\s*(.+)$/i);
  if (mPart) {
    partCount++;
    srcPartTitles.push(norm(mPart[2]));
    currentPart = { part: parseInt(mPart[1], 10) };
    currentTopic = null;
    inSelfCheck = false;
    continue;
  }

  if (line === 'Daily Student Self-Check') {
    inSelfCheck = true;
    currentTopic = null;
    continue;
  }
  if (inSelfCheck) {
    srcSelfCheck.push(line);
    continue;
  }

  const mTopic = line.match(/^(\d+)\.\s+(.+)$/);
  if (mTopic) {
    const id = parseInt(mTopic[1], 10);
    if (id >= 1 && id <= 32) {
      currentTopic = { id, title: mTopic[2].trim(), bullets: [], table: null };
      srcById.set(id, currentTopic);
      continue;
    }
  }

  // Topic 31 table.
  if (currentTopic && currentTopic.id === 31 && line.includes('|')) {
    if (!currentTopic.table) {
      currentTopic.table = { headers: line.split('|').map((s) => s.trim()), rows: [] };
    } else {
      currentTopic.table.rows.push(line.split('|').map((s) => s.trim()));
    }
    continue;
  }

  if (currentTopic && !currentTopic.table) {
    currentTopic.bullets.push(line);
  }
}

const srcTopicCount = srcById.size;
const srcBulletCount = [...srcById.values()].reduce((a, t) => a + (t.table ? 0 : t.bullets.length), 0);

// ─── Compare titles ───────────────────────────────────────────────────────
const missingTitles = [];
const extraTitles = [];
const titleOrderMismatch = [];

for (const [id, t] of dataById) {
  const nt = norm(t.title);
  const st = srcById.has(id) ? norm(srcById.get(id).title) : null;
  if (st === null) missingTitles.push(id + '. ' + t.title);
  else if (nt !== st) titleOrderMismatch.push(id + ': data="' + t.title + '" source="' + srcById.get(id).title + '"');
}
for (const [id, t] of srcById) {
  if (!dataById.has(id)) extraTitles.push('source topic ' + id + '. ' + t.title);
}

// ─── Compare bullets (non-table topics): membership + order ───────────────
const missingBullets = [];
const extraBullets = [];
const bulletOrderMismatch = [];

for (const [id, t] of dataById) {
  const st = srcById.get(id);
  if (!st || st.table) continue; // topic 31 is a table
  const srcNorms = st.bullets.map(norm);
  const dataNorms = t.bullets.map(norm);
  // membership
  for (const b of t.bullets) {
    const nb = norm(b);
    if (!nb) continue;
    if (!srcNorms.includes(nb)) missingBullets.push(id + '. ' + t.title + ' :: ' + b);
  }
  for (const b of st.bullets) {
    const nb = norm(b);
    if (!nb) continue;
    if (!dataNorms.includes(nb)) extraBullets.push('source topic ' + id + ' :: ' + b);
  }
  // order (exact, after norm)
  if (dataNorms.length !== srcNorms.length) {
    bulletOrderMismatch.push(id + '. ' + t.title + ': data has ' + dataNorms.length + ' bullets, source has ' + srcNorms.length);
  } else {
    for (let i = 0; i < dataNorms.length; i++) {
      if (dataNorms[i] !== srcNorms[i]) {
        bulletOrderMismatch.push(id + '. ' + t.title + ': bullet ' + (i + 1) + ' order differs');
        break;
      }
    }
  }
}

// ─── Compare topic 31 table ───────────────────────────────────────────────
const tableMismatch = [];
const t31Data = dataById.get(31);
const t31Src = srcById.get(31);
if (t31Data && t31Src) {
  const dh = t31Data.table ? t31Data.table.headers.map(norm) : [];
  const sh = t31Src.table ? t31Src.table.headers.map(norm) : [];
  if (dh.join('|') !== sh.join('|')) tableMismatch.push('topic 31 headers differ');
  if ((t31Data.table ? t31Data.table.rows.length : 0) !== (t31Src.table ? t31Src.table.rows.length : 0)) {
    tableMismatch.push('topic 31 row count differs: data=' + (t31Data.table ? t31Data.table.rows.length : 0) + ' source=' + (t31Src.table ? t31Src.table.rows.length : 0));
  } else {
    for (let r = 0; r < (t31Src.table ? t31Src.table.rows.length : 0); r++) {
      const da = (t31Data.table ? t31Data.table.rows[r] : []).map(norm);
      const sa = (t31Src.table ? t31Src.table.rows[r] : []).map(norm);
      if (da.join('|') !== sa.join('|')) tableMismatch.push('topic 31 row ' + (r + 1) + ' differs');
    }
  }
}

// ─── Compare self-check ───────────────────────────────────────────────────
const missingSelfCheck = [];
const extraSelfCheck = [];
const selfCheckOrderMismatch = [];
const srcSCNorms = srcSelfCheck.map(norm);
const dataSCNorms = selfCheckData.map(norm);
for (const s of selfCheckData) {
  const ns = norm(s);
  if (!ns) continue;
  if (!srcSCNorms.includes(ns)) missingSelfCheck.push(s);
}
for (const s of srcSelfCheck) {
  const ns = norm(s);
  if (!ns) continue;
  if (!dataSCNorms.includes(ns)) extraSelfCheck.push(s);
}
if (dataSCNorms.length !== srcSCNorms.length) {
  selfCheckOrderMismatch.push('self-check: data has ' + dataSCNorms.length + ' items, source has ' + srcSCNorms.length);
} else {
  for (let i = 0; i < dataSCNorms.length; i++) {
    if (dataSCNorms[i] !== srcSCNorms[i]) {
      selfCheckOrderMismatch.push('self-check item ' + (i + 1) + ' order differs');
      break;
    }
  }
}

// ─── Totals ───────────────────────────────────────────────────────────────
const missingTotal =
  missingTitles.length + missingBullets.length + tableMismatch.length + missingSelfCheck.length;
const extraTotal =
  extraTitles.length + extraBullets.length + extraSelfCheck.length;
const orderMismatchTotal =
  titleOrderMismatch.length + bulletOrderMismatch.length + selfCheckOrderMismatch.length;

console.log('=== Ethics content check ===');
console.log('Parts:', partCount, '(data parts:', parts.length, ')');
console.log('Source topics parsed:', srcTopicCount, '(data topics:', topicCount, ')');
console.log('Source bullets parsed:', srcBulletCount, '(data bullets:', bulletCount, ')');
console.log('Source table rows (topic 31):', t31Src ? (t31Src.table ? t31Src.table.rows.length : 0) : 0, '(data table rows:', tableRowCount, ')');
console.log('Source self-check items:', srcSelfCheck.length, '(data self-check:', selfCheckData.length, ')');
console.log('');
console.log('Titles matched:', topicCount - missingTitles.length);
console.log('Bullets matched:', bulletCount - missingBullets.length);
console.log('Missing titles:', missingTitles.length);
console.log('Missing bullets:', missingBullets.length);
console.log('Extra titles:', extraTitles.length);
console.log('Extra bullets:', extraBullets.length);
console.log('Self-check matched:', selfCheckData.length - missingSelfCheck.length);
console.log('Missing self-check:', missingSelfCheck.length);
console.log('Extra self-check:', extraSelfCheck.length);
console.log('Table mismatches:', tableMismatch.length);
console.log('Order mismatches (titles/bullets/self-check):', orderMismatchTotal);

const hasAnyMissing = missingTotal > 0;
const hasAnyExtra = extraTotal > 0;
const hasAnyOrder = orderMismatchTotal > 0;
const hasAnyTable = tableMismatch.length > 0;

console.log('');
if (hasAnyMissing) {
  console.log('--- Missing titles ---');
  missingTitles.forEach((t) => console.log('  - ' + t));
  console.log('--- Missing bullets ---');
  missingBullets.forEach((b) => console.log('  - ' + b));
  console.log('--- Missing self-check ---');
  missingSelfCheck.forEach((s) => console.log('  - ' + s));
}
if (hasAnyExtra) {
  console.log('--- Extra titles ---');
  extraTitles.forEach((t) => console.log('  - ' + t));
  console.log('--- Extra bullets ---');
  extraBullets.forEach((b) => console.log('  - ' + b));
  console.log('--- Extra self-check ---');
  extraSelfCheck.forEach((s) => console.log('  - ' + s));
}
if (hasAnyTable) {
  console.log('--- Table mismatches ---');
  tableMismatch.forEach((m) => console.log('  - ' + m));
}
if (hasAnyOrder) {
  console.log('--- Order mismatches ---');
  [...titleOrderMismatch, ...bulletOrderMismatch, ...selfCheckOrderMismatch].forEach((m) => console.log('  - ' + m));
}

const pass = !hasAnyMissing && !hasAnyExtra && !hasAnyTable && !hasAnyOrder;
console.log('\n' + (pass ? 'RESULT: PASS — zero mismatches.' : 'RESULT: FAIL — mismatches found.'));
process.exit(pass ? 0 : 1);
