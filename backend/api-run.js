import OpenAI from "openai";

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

    const {
      text,
      platform = "Both",
      tone = "احترافية",
      audience = "رواد الأعمال",
      language = "ar", // ✅ ar | en
    } = req.body || {};

    const inputText = String(text || "").trim();
    if (!inputText) return res.status(400).json({ ok: false, error: "text is required" });

    // ✅ سطر واحد يحدد لغة الإخراج
    const langLine =
      String(language).toLowerCase() === "en"
        ? "Write the output in English."
        : "اكتب المخرجات باللغة العربية.";

    const prompt = `
You are a professional social content writer.
Generate ready-to-publish content based on:

Platform: ${platform}
Tone: ${tone}
Audience: ${audience}

Topic:
${inputText}

Output rules:
- Do NOT write any technical explanation.
- ${langLine}
- If Platform = Both: return TWO sections, exactly:
  (LinkedIn)
  ...text...
  (X)
  ...text...
- If Platform = LinkedIn: return ONLY (LinkedIn)
- If Platform = X: return ONLY (X)
- X MUST be 280 characters or less (including spaces).
- Make it clean, formatted, and copy-friendly.
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const outputText =
      response.output_text || response.output?.[0]?.content?.[0]?.text || "";

    return res.json({ ok: true, output: outputText || "No output" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error",
    });
  }
}