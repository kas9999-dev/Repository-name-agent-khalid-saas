// backend/api-run.js
import OpenAI from "openai";

function clampX(s) {
  if (!s) return "";
  s = String(s).trim();
  if (s.length <= 280) return s;
  return s.slice(0, 277).trimEnd() + "...";
}

function platformLabel(platform) {
  if (!platform) return "Nashr";
  const p = String(platform).toLowerCase();
  if (p.includes("linkedin") && p.includes("x")) return "Nashr (LinkedIn + X)";
  if (p.includes("linkedin")) return "Nashr (LinkedIn)";
  if (p === "x" || p.includes("twitter")) return "Nashr (X)";
  return "Nashr";
}

function buildSystem(language) {
  const isEN = language === "en";
  return isEN
    ? `You are Nashr, a professional social media content generator.
Rules:
- Output MUST be in English only.
- No "Version 1/2", no bilingual output, no translation.
- Use clear structure, professional tone, and ready-to-post writing.
- If platform is X: keep it <= 280 chars.
- If platform is LinkedIn: allow longer, add value and clarity.
- Start the post with: "Nashr | " followed by a short hook line.
Return only the post text.`
    : `أنت "نشر" Nashr مولّد محتوى احترافي لمنصات التواصل.
القواعد:
- المخرجات MUST تكون بالعربية فقط.
- ممنوع (Version 1/2) أو إخراج ثنائي لغة أو ترجمة.
- جاهز للنشر، واضح ومهني.
- إذا المنصة X: لا تتجاوز 280 حرف.
- إذا LinkedIn: مسموح أطول مع قيمة وترتيب.
- ابدأ المنشور بسطر: "Nashr | " ثم Hook مختصر.
أعد النص النهائي فقط دون أي شروحات.`;
}

function buildUser({ text, platform, tone, audience, language }) {
  const isEN = language === "en";
  const plat = platform || "LinkedIn + X";
  const t = tone || (isEN ? "Professional" : "احترافية");
  const a = audience || (isEN ? "Business Owners" : "رواد الأعمال");

  return isEN
    ? `Topic: ${text}
Platform: ${plat}
Tone: ${t}
Audience: ${a}

Deliver ONE ready-to-post text only.`
    : `الموضوع: ${text}
المنصة: ${plat}
النبرة: ${t}
الجمهور: ${a}

أعد نصًا واحدًا جاهزًا للنشر فقط.`;
}

async function generate(openai, { text, platform, tone, audience, language }) {
  const sys = buildSystem(language);
  const usr = buildUser({ text, platform, tone, audience, language });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const resp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ],
    temperature: 0.7
  });

  const out = (resp.choices?.[0]?.message?.content || "").trim();

  // Platform-specific shaping
  const plat = String(platform || "").toLowerCase();
  const isX = plat === "x" || plat.includes("twitter");
  const label = platformLabel(platform);

  let finalText = out;

  // Ensure brand line at top (extra safety)
  if (!finalText.toLowerCase().startsWith("nashr |")) {
    finalText = `Nashr | ${finalText}`;
  }

  if (isX) {
    finalText = clampX(finalText);
  }

  return { finalText, label };
}

export default async function apiRun(req, res) {
  try {
    const { text, platform, tone, audience, language } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const lang = language === "en" ? "en" : "ar";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // If user selects "LinkedIn + X" we generate TWO separate outputs (clean and predictable)
    const plat = platform || "LinkedIn + X";
    const lower = String(plat).toLowerCase();

    let linkedin = "";
    let x = "";

    if (lower.includes("linkedin") && lower.includes("x")) {
      // LinkedIn version
      const li = await generate(openai, {
        text,
        platform: "LinkedIn",
        tone,
        audience,
        language: lang
      });
      linkedin = li.finalText;

      // X version
      const tw = await generate(openai, {
        text,
        platform: "X",
        tone,
        audience,
        language: lang
      });
      x = tw.finalText;

      return res.json({
        ok: true,
        output: { linkedin, x, language: lang }
      });
    }

    if (lower.includes("linkedin")) {
      const li = await generate(openai, { text, platform: "LinkedIn", tone, audience, language: lang });
      linkedin = li.finalText;
      return res.json({ ok: true, output: { linkedin, x: "", language: lang } });
    }

    // Default to X
    const tw = await generate(openai, { text, platform: "X", tone, audience, language: lang });
    x = tw.finalText;
    return res.json({ ok: true, output: { linkedin: "", x, language: lang } });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error"
    });
  }
}