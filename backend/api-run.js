import OpenAI from "openai";

// ===== Simple Usage Limit (Demo) =====
const DAILY_LIMIT = 5;
const usageStore = new Map();

function getClientKey(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const today = new Date().toISOString().slice(0, 10);
  return `${ip}_${today}`;
}

// ===== API Handler =====
export default async function apiRun(req, res) {
  try {
    // ===== Usage Limit Check =====
    const key = getClientKey(req);
    const current = usageStore.get(key) || 0;

    if (current >= DAILY_LIMIT) {
      return res.status(429).json({
        ok: false,
        code: "USAGE_LIMIT",
        message: "تم الوصول للحد اليومي للتجربة",
        limit: DAILY_LIMIT
      });
    }

    usageStore.set(key, current + 1);

    // ===== OpenAI Key =====
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY (set it in Render Environment Variables)."
      });
    }

    const client = new OpenAI({ apiKey });

    // ===== Input =====
    const {
      text,
      platform = "Both",
      tone = "احترافية",
      audience = "رواد الأعمال"
    } = req.body || {};

    const inputText = String(text || "").trim();
    if (!inputText) {
      return res.status(400).json({
        ok: false,
        error: "text is required"
      });
    }

    // ===== Prompt =====
    const prompt = `
أنت مساعد كتابة محتوى احترافي.

اكتب محتوى جاهز للنشر وفق البيانات التالية:

Platform: ${platform}
Tone: ${tone}
Audience: ${audience}

الفكرة / الموضوع:
${inputText}

قواعد الإخراج:
- لا تكتب أي شرح تقني.
- إذا Platform = Both:
  • LinkedIn: فقرة احترافية واضحة.
  • X: نص لا يتجاوز 280 حرفًا.
- اجعل النص مباشرًا، واضحًا، وقابلًا للنسخ.
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // ===== OpenAI Call =====
    const response = await client.responses.create({
      model,
      input: prompt
    });

    const outputText =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    return res.json({
      ok: true,
      output: outputText || "No output"
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error"
    });
  }
}