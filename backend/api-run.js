import OpenAI from "openai";

function safeStr(v) {
  return String(v ?? "").trim();
}

function normalizePlatform(p) {
  const s = safeStr(p).toLowerCase();

  // أي صيغة فيها + أو both تعتبر Both
  if (s.includes("+") || s.includes("both") || s.includes("linkedin+x") || s.includes("linkedin + x")) {
    return "Both";
  }

  // لو ذكر LinkedIn فقط
  if (s.includes("linkedin") && !s.includes("x")) return "LinkedIn";

  // لو ذكر X فقط
  if (s === "x" || (s.includes("x") && !s.includes("linkedin"))) return "X";

  // افتراضي
  return "Both";
}

function clampX(text) {
  const t = safeStr(text);
  return t.length > 280 ? t.slice(0, 277) + "…" : t;
}

function extractTextFromResponse(response) {
  return (
    response?.output_text ||
    response?.output?.[0]?.content?.[0]?.text ||
    ""
  );
}

function tryParseJSON(text) {
  const t = safeStr(text);
  if (!t) return null;

  const cleaned = t
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default async function apiRun(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY (set it in Render Environment Variables).",
      });
    }

    const client = new OpenAI({ apiKey });

    const body = req.body || {};
    const inputText = safeStr(body.text);
    const platform = normalizePlatform(body.platform || "Both");
    const tone = safeStr(body.tone || "احترافية");
    const audience = safeStr(body.audience || "رواد الأعمال");

    if (!inputText) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    const prompt = `
أنت مساعد كتابة محتوى احترافي.

اكتب محتوى جاهز للنشر بناءً على:
- Tone: ${tone}
- Audience: ${audience}
- Topic: ${inputText}

المطلوب (الالتزام إلزامي):
1) أعد المخرجات بصيغة JSON فقط وبدون أي شرح أو نص خارج JSON.
2) المفاتيح المطلوبة:
   - "linkedin": نص لينكدإن (قد يكون طويلًا ومنسقًا).
   - "x": نص منصة X لا يتجاوز 280 حرفًا.
3) إذا platform = "LinkedIn": اجعل x = "".
   إذا platform = "X": اجعل linkedin = "".
   إذا platform = "Both": املأ الاثنين.
4) نص X يجب أن يكون <= 280 حرفًا.

platform = "${platform}"

أعد JSON فقط:
{"linkedin":"...","x":"..."}
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const raw = extractTextFromResponse(response);
    const parsed = tryParseJSON(raw);

    let linkedin = "";
    let x = "";

    if (parsed && typeof parsed === "object") {
      linkedin = safeStr(parsed.linkedin);
      x = safeStr(parsed.x);
    } else {
      // fallback: لو رجع نص عادي
      if (platform === "X") {
        x = clampX(raw);
      } else if (platform === "LinkedIn") {
        linkedin = raw;
      } else {
        linkedin = raw;
        x = clampX(raw);
      }
    }

    x = clampX(x);

    return res.json({
      ok: true,
      linkedin,
      x,
      raw,
      meta: {
        platform,
        xChars: x.length,
        model,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error",
    });
  }
}