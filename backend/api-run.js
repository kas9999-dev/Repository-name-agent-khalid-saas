// backend/api-run.js
import OpenAI from "openai";
import { buildPrompt } from "../frontend/agentPrompt.js";

export default async function apiRun(req, res) {
  try {
    const { text, platform, tone, audience, language } = req.body || {};

    if (!text || !platform) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: text, platform"
      });
    }

    const lang = (language === "en") ? "en" : "ar";

    const prompt = buildPrompt({
      text: String(text || "").trim(),
      platform: String(platform || "linkedin_x"),
      tone: String(tone || "professional"),
      audience: String(audience || "business"),
      language: lang
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a precise social media copywriter. Follow instructions exactly. Output MUST be valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const raw =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    const parsed = safeJsonParse(raw);

    // ✅ نرجّع شكل ثابت للواجهة
    const out = {
      x: parsed?.x ?? "",
      linkedin: parsed?.linkedin ?? "",
      language: lang
    };

    return res.json({ ok: true, output: out });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error"
    });
  }
}

// يحاول يلقط JSON حتى لو النموذج أضاف نص زائد
function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch (_) {}
    }
    return null;
  }
}