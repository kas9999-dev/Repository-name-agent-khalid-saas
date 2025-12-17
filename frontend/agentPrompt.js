// frontend/agentPrompt.js

export function buildPrompt({ text, platform, tone, audience, language }) {
  const lang = language === "en" ? "en" : "ar";
  const isBoth = platform === "linkedin_x";
  const isXOnly = platform === "x";
  const isLinkedInOnly = platform === "linkedin";

  // عنوان/اسم المنصة في بداية المنشور
  const brandLine =
    lang === "en"
      ? "🧠 Nashr | "
      : "🧠 نشر | ";

  // تعليمات اللغة
  const langRule =
    lang === "en"
      ? "Write ONLY in English."
      : "اكتب بالعربية فقط.";

  // تعليمات X
  const xRules =
    lang === "en"
      ? `For X: MUST be <= 280 characters TOTAL (including spaces and hashtags). Start with "${brandLine}". Keep it punchy.`
      : `لمنصة X: لازم لا يتجاوز 280 حرفًا إجمالاً (مع المسافات والهاشتاقات). يبدأ بـ "${brandLine}". يكون مختصرًا وقويًا.`;

  // تعليمات LinkedIn
  const liRules =
    lang === "en"
      ? `For LinkedIn: Start with "${brandLine}". 1 short hook line, then 2–4 short paragraphs, then 3–5 hashtags max.`
      : `لـ LinkedIn: يبدأ بـ "${brandLine}". سطر افتتاحي جذاب ثم 2–4 فقرات قصيرة ثم 3–5 هاشتاقات كحد أقصى.`;

  // نبرة وجمهور
  const meta =
    lang === "en"
      ? `Tone: ${tone}. Audience: ${audience}.`
      : `النبرة: ${tone}. الجمهور: ${audience}.`;

  // المطلوب إخراج JSON فقط
  const outputSchema =
    `Return ONLY valid JSON with keys: "x" and "linkedin". ` +
    `If platform does not require a key, return it as empty string.`;

  // ماذا نولّد؟
  const needX = isBoth || isXOnly;
  const needLI = isBoth || isLinkedInOnly;

  const task =
    lang === "en"
      ? `Topic/Idea: ${text}`
      : `الفكرة/الموضوع: ${text}`;

  const instructions = [
    langRule,
    meta,
    needX ? xRules : "",
    needLI ? liRules : "",
    outputSchema
  ].filter(Boolean).join("\n");

  return `${instructions}\n\n${task}`;
}