// ─── scripts/generate-ethics-content.mjs ─────────────────────────────────────
// Dev-only one-time conversion (NOT deployed, NOT in the service worker cache).
// Regenerates /lib/ethicsContent.js topics 1-32 from scripts/ethics-source.txt
// so titles, bullet wording and bullet order match the official guide exactly.
// Keeps each Part's summary / simple / chip, and leaves scenarios, mythFacts,
// sources and the header comment untouched. Replaces ETHICS_SELF_CHECK with the
// 10 source lines. Re-applies takeaway flags only on verbatim source bullets
// that are clearly summary sentences (max one per topic, max 10 page-wide).
import fs from 'fs';

const CONTENT_PATH = '/root/Stuvo-Git/stuvo/lib/ethicsContent.js';
const SOURCE_PATH = '/root/Stuvo-Git/stuvo/scripts/ethics-source.txt';

function q(s) {
  return "'" + String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n') + "'";
}

// Curly quotes/apostrophes -> straight; collapse whitespace; trim; lowercase;
// strip trailing periods. Used for matching source<->data and dedupe.
function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
}

// ─── Parse the source text ────────────────────────────────────────────────
const sourceText = fs.readFileSync(SOURCE_PATH, 'utf8');
const lines = sourceText.split('\n');

const srcParts = [];   // { part, title, topics: [{id,title,bullets[]|table}] }
let selfCheck = [];
let currentPart = null;
let currentTopic = null;
let inSelfCheck = false;

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  const mPart = line.match(/^Part (\d+):\s*(.+)$/);
  if (mPart) {
    currentPart = { part: parseInt(mPart[1], 10), title: mPart[2].trim(), topics: [] };
    srcParts.push(currentPart);
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
    selfCheck.push(line);
    continue;
  }

  const mTopic = line.match(/^(\d+)\.\s+(.+)$/);
  if (mTopic) {
    const id = parseInt(mTopic[1], 10);
    if (id >= 1 && id <= 32) {
      currentTopic = { id, title: mTopic[2].trim(), bullets: [] };
      currentPart.topics.push(currentTopic);
      continue;
    }
  }

  // Topic 31 table: header line "Situation | The right thing to do", then rows.
  if (currentTopic && currentTopic.id === 31 && line.includes('|')) {
    if (!currentTopic.table) {
      currentTopic.table = {
        headers: line.split('|').map((s) => s.trim()),
        rows: [],
      };
    } else {
      currentTopic.table.rows.push(line.split('|').map((s) => s.trim()));
    }
    continue;
  }

  // Regular bullet for the current topic (non-table).
  if (currentTopic && !currentTopic.table) {
    currentTopic.bullets.push(line);
  }
}

// ─── Takeaway flags: only on verbatim source bullets that are clearly
//    summary sentences, max one per topic, max 10 page-wide. ───────────────
const takeawayMap = {
  4: 'Understand that environmental protection is a shared responsibility.',
  5: 'Remember that respect should extend to everyone, not only people in positions of authority.',
  11: "A child's basic rights are not rewards for good behaviour. Rights and responsibilities are related, but a child does not lose protection from abuse because they have misbehaved.",
  13: 'Remember that responsibility for abuse lies with the person committing it, not the child experiencing it.',
  15: 'Remember that online actions can have real-world consequences.',
  18: 'Asking for help is a responsible action, not a weakness.',
  23: 'Recognise that allegations require evidence and that legal questions depend on specific circumstances.',
  29: 'Asking for help is not disobedience. Every child deserves safety, dignity, education, and protection.',
};

const flagged = [];
for (const topic of srcParts.flatMap((p) => p.topics)) {
  if (topic.table) continue;
  const want = takeawayMap[topic.id];
  if (!want) continue;
  const idx = topic.bullets.findIndex((b) => norm(b) === norm(want));
  if (idx >= 0) {
    topic.bullets[idx] = { text: topic.bullets[idx], takeaway: true };
    flagged.push({ id: topic.id, title: topic.title, bullet: topic.bullets[idx].text });
  }
}

// ─── Load existing data for part-level metadata + unchanged sections ────────
globalThis.window = {};
const oldCode = fs.readFileSync(CONTENT_PATH, 'utf8');
eval(oldCode);
const oldParts = window.ETHICS_CONTENT || [];
const scenarios = window.ETHICS_SCENARIOS || [];
const mythFacts = window.ETHICS_MYTH_FACTS || [];
const sources = window.ETHICS_SOURCES || [];

// ─── Build new ETHICS_CONTENT ─────────────────────────────────────────────
function topicLiteral(t) {
  if (t.table) {
    const heads = t.table.headers.map(q).join(', ');
    const rows = t.table.rows.map((r) => '[' + r.map(q).join(', ') + ']').join(', ');
    return `{ id: ${t.id}, title: ${q(t.title)}, table: { headers: [${heads}], rows: [${rows}] } }`;
  }
  const bullets = t.bullets.map((b) =>
    typeof b === 'object' ? `{ text: ${q(b.text)}, takeaway: true }` : q(b)
  ).join(',\n    ');
  return `{ id: ${t.id}, title: ${q(t.title)}, bullets: [\n    ${bullets}\n  ] }`;
}

const newParts = srcParts.map((sp) => {
  const old = oldParts.find((p) => p.part === sp.part) || {};
  const topics = sp.topics.map((t) => '  ' + topicLiteral(t)).join(',\n');
  return (
    `{\n` +
    `  part: ${sp.part},\n` +
    `  shortName: ${q(old.shortName || String(sp.part))},\n` +
    `  partTitle: ${q(sp.title)},\n` +
    `  summary: ${q(old.summary || '')},\n` +
    `  simple: [${(old.simple || []).map(q).join(', ')}],\n` +
    `  chip: ${q(old.shortName || String(sp.part))},\n` +
    `  topics: [\n${topics}\n  ]\n` +
    `}`
  );
});

const selfCheckLiteral = '[\n  ' + selfCheck.map(q).join(',\n  ') + '\n]';

const out =
`// ─── Ethics page content — read-only student awareness guide ────────────────
// All body text for the #/ethics page lives here. The render module reads
// window.ETHICS_CONTENT, window.ETHICS_SELF_CHECK, window.ETHICS_SCENARIOS,
// window.ETHICS_MYTH_FACTS and window.ETHICS_SOURCES.
// No text is hardcoded in HTML or the router. No emojis.
// Each part carries a one-sentence summary (<= 20 words), a simple[] array of
// 3 lines for Simple mode, and a chip label.
// Topics have id, title, bullets. A bullet flagged takeaway: true renders as a
// "Key takeaway" block (at most one per topic, at most 10 topics across page).
window.ETHICS_CONTENT = [
${newParts.join(',\n')}
];

window.ETHICS_SELF_CHECK = ${selfCheckLiteral};

window.ETHICS_SCENARIOS = ${JSON.stringify(scenarios, null, 2)};

window.ETHICS_MYTH_FACTS = ${JSON.stringify(mythFacts, null, 2)};

window.ETHICS_SOURCES = ${JSON.stringify(sources, null, 2)};
`;

fs.writeFileSync(CONTENT_PATH, out);

console.log('Parts parsed:', srcParts.length);
console.log('Topics parsed:', srcParts.reduce((a, p) => a + p.topics.length, 0));
console.log('Self-check items parsed:', selfCheck.length);
console.log('Takeaways flagged:', flagged.length);
flagged.forEach((f) => console.log('  - topic ' + f.id + ': ' + f.bullet.slice(0, 70) + '…'));
console.log('Wrote ' + CONTENT_PATH);
