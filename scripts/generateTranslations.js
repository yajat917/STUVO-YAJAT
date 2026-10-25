const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Canonical source: stuvo/lang/en.json (mirrored to lang/en.json — both must stay in sync).
const STUVO_EN = path.join(__dirname, '../stuvo/lang/en.json');
const ROOT_EN = path.join(__dirname, '../lang/en.json');
const enPath = fs.existsSync(STUVO_EN) ? STUVO_EN : ROOT_EN;
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const LANGUAGES = {
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil'
};

// Per-section chunking: the full 900-key file (~15-20k tokens of JSON) gets
// truncated at max_tokens 4000, producing unparseable JSON. Translating one
// top-level section at a time keeps every response well under the limit.
async function translateSection(sectionObj, langName, section) {
  const prompt = `Translate every string value in this JSON object into ${langName}, keeping all keys exactly the same. This is UI text for a school platform used by students and teachers — keep translations natural, age-appropriate, and commonly understood (avoid overly formal or literary word choices). Keep any {placeholder} tokens exactly as they are, untranslated. Return ONLY the translated JSON object, no markdown, no explanation.

${JSON.stringify(sectionObj, null, 2)}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b:free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8000
    })
  });
  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error(`empty model response for section ${section} (${JSON.stringify(data).slice(0, 200)})`);
  const raw = content.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`unparseable JSON for section ${section}: ${e.message} — raw head: ${raw.slice(0, 200)}`);
  }
}

async function translateJSON(code, langName) {
  const out = {};
  for (const [section, sectionObj] of Object.entries(en)) {
    console.log(`  … ${section} (${Object.keys(sectionObj).length} keys)`);
    out[section] = await translateSection(sectionObj, langName, section);
  }
  return out;
}

async function run() {
  const only = process.argv[2]; // optional: node generateTranslations.js hi
  for (const [code, name] of Object.entries(LANGUAGES)) {
    if (only && only !== code) continue;
    console.log(`Translating to ${name}...`);
    try {
      const translated = await translateJSON(code, name);
      const roots = [
        path.join(__dirname, `../lang/${code}.json`),
        path.join(__dirname, `../stuvo/lang/${code}.json`),
      ];
      for (const p of roots) {
        fs.writeFileSync(p, JSON.stringify(translated, null, 2));
        console.log(`✓ Saved ${path.relative(path.join(__dirname, '..'), p)}`);
      }
    } catch (e) {
      console.error(`✗ Failed to translate ${name}:`, e.message);
    }
  }
}

run();
