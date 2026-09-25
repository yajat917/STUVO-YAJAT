const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const envPaths = [
      path.resolve(__dirname, '../../.env.local'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '.env')
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(/OPENROUTER_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          const key = match[1].trim().replace(/^["']|["']$/g, '');
          process.env.OPENROUTER_API_KEY = key;
          return key;
        }
      }
    }
  } catch (e) {}
  return null;
}

// Auto-initialize key into environment
getApiKey();

const MODELS = [
  "openrouter/free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-31b-it:free"
];

const FORMAT_STANDARD = `
FORMATTING RULES — follow these exactly in every response:
- Never use LaTeX. Never use $ or $$ symbols. Never use \\frac, \\sqrt, \\times, or any backslash commands.
- For math, use plain readable text only:
  - Powers: x^2, x^3 (caret symbol, no superscript formatting)
  - Roots: √x or "square root of x" — never \\sqrt
  - Fractions: write as (numerator)/(denominator), e.g. (3)/(4), not \\frac{3}{4}
  - Multiplication: × or *
  - Division: ÷ or /
  - Do not use markdown bold/italic (** or *) inside explanations — plain text only
- For step-by-step explanations, number each step clearly: "1. ...", "2. ...", "3. ..."
- Keep sentences short and direct. No filler phrases like "Let's dive in" or "Great question!"
- Never wrap the entire response in markdown code blocks unless explicitly asked for code
- If the response must be JSON (per the specific prompt below), return ONLY valid JSON with no markdown fences, no backticks, no explanation text before or after
`;

// Unified AI voice for Study Hub tutoring features ONLY.
// Non-Study-Hub features (Wellbeing Assistant, Class Pulse, Homework Summary)
// keep their own existing distinct voices and must NOT use this preamble.
const STUVO_TUTOR_VOICE = `
You are the Stuvo Tutor, an AI study assistant for a school student.
- You already know the student's grade level and subject — never ask what you've already been told.
- Match explanation complexity to the student's grade: simpler analogies and shorter steps for grades 9-10, more technical depth for grades 11-12.
- Be encouraging and direct. Treat the student as capable. Never patronizing, never padded with filler phrases like "Great question!" or "Let's dive in!"
- Never invent facts, homework, or data not given to you in the prompt context.
`;

async function callOpenRouter(prompt, model = MODELS[0], attempt = 0) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set.");
  }

  let messages;
  let selectedModel = typeof model === 'object' && model !== null ? (model.model || MODELS[0]) : model;
  let max_tokens = 1000;
  let temperature = 0.7;

  if (Array.isArray(prompt)) {
    // Prepend FORMAT_STANDARD to existing messages
    const baseMessages = prompt.slice();
    if (baseMessages.length > 0 && baseMessages[0].role === 'system') {
      baseMessages[0] = { ...baseMessages[0], content: FORMAT_STANDARD.trim() + "\n\n" + baseMessages[0].content };
    } else {
      baseMessages.unshift({ role: 'system', content: FORMAT_STANDARD.trim() });
    }
    messages = baseMessages;
    if (typeof model === 'object' && model !== null) {
      if (model.maxTokens) max_tokens = model.maxTokens;
      if (model.temperature !== undefined) temperature = model.temperature;
    }
  } else {
    const fullPrompt = FORMAT_STANDARD.trim() + "\n\n" + String(prompt);
    messages = [{ role: "user", content: fullPrompt }];
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://stuvo-eosin.vercel.app",
        "X-Title": "Stuvo"
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages,
        max_tokens: max_tokens,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Model ${selectedModel} returned HTTP ${response.status}: ${errText.slice(0, 100)}`);
      if (attempt < MODELS.length - 1) {
        const nextModel = MODELS[attempt + 1];
        console.log(`Retrying with fallback model ${nextModel}...`);
        const nextOpt = typeof model === 'object' && model !== null ? { ...model, model: nextModel } : nextModel;
        return callOpenRouter(prompt, nextOpt, attempt + 1);
      }
      throw new Error(`OpenRouter error (${response.status}): ${errText}`);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error("OpenRouter returned non-JSON: " + rawText);
    }

    if (data.error) {
      if (attempt < MODELS.length - 1) {
        const nextModel = MODELS[attempt + 1];
        const nextOpt = typeof model === 'object' && model !== null ? { ...model, model: nextModel } : nextModel;
        return callOpenRouter(prompt, nextOpt, attempt + 1);
      }
      throw new Error(data.error.message || "OpenRouter error");
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Unexpected OpenRouter response structure");
    }

    return data.choices[0].message.content;
  } catch (err) {
    if (attempt < MODELS.length - 1) {
      const nextModel = MODELS[attempt + 1];
      console.warn(`Error on attempt ${attempt} (${selectedModel}): ${err.message}. Retrying with ${nextModel}...`);
      const nextOpt = typeof model === 'object' && model !== null ? { ...model, model: nextModel } : nextModel;
      return callOpenRouter(prompt, nextOpt, attempt + 1);
    }
    throw err;
  }
}

function parseJSON(text) {
  if (!text) throw new Error('Empty response');
  try {
    return JSON.parse(text);
  } catch (e) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (e) {}
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.slice(firstBracket, lastBracket + 1));
    } catch (e) {}
  }

  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function cleanMathFormatting(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\$\$(.*?)\$\$/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .trim();
}

module.exports = { callOpenRouter, parseJSON, cleanMathFormatting, FORMAT_STANDARD, STUVO_TUTOR_VOICE };
