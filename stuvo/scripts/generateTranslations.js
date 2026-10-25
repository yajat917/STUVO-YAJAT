const fs = require('fs');
const path = require('path');
require('dotenv').config();

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../lang/en.json'), 'utf8'));

const LANGUAGES = {
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil'
};

async function translateJSON(langName) {
  const prompt = `Translate every string value in this JSON object into ${langName}, keeping all keys and structure exactly the same. This is UI text for a school platform used by students and teachers — keep translations natural, age-appropriate, and commonly understood (avoid overly formal or literary word choices). Keep any {placeholder} tokens exactly as they are, untranslated. Return ONLY the translated JSON, no markdown, no explanation.

${JSON.stringify(en, null, 2)}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b:free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000
    })
  });
  const data = await response.json();
  const raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function run() {
  for (const [code, name] of Object.entries(LANGUAGES)) {
    console.log(`Translating to ${name}...`);
    try {
      const translated = await translateJSON(name);
      fs.writeFileSync(path.join(__dirname, `../lang/${code}.json`), JSON.stringify(translated, null, 2));
      console.log(`✓ Saved lang/${code}.json`);
    } catch (e) {
      console.error(`✗ Failed to translate ${name}:`, e.message);
    }
  }
}

run();
