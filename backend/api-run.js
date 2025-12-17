import OpenAI from "openai";

export default async function apiRun(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY"
      });
    }

    const client = new OpenAI({ apiKey });

    const {
      text,
      platform = "Both",
      tone = "احترافية",
      audience = "رواد الأعمال",
      language = "ar" // ar | en
    } = req.body || {};

    const inputText = String(text || "").trim();
    if (!inputText) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    // 🔑 تحديد لغة الإخراج بشكل صريح
    const languageInstruction =
      language === "en"
        ? "Write the content strictly in English. Do NOT use Arabic under any circumstance."
        : "اكتب المحتوى باللغة العربية فقط.";

    const prompt = `
You are a professional content writer.

${languageInstruction}

Platform: ${platform}
Tone: ${tone}
Audience: ${audience}

Topic:
${inputText}

Output rules:
- No technical explanations.
- If Platform = Both: provide two versions clearly labeled.
- The content must be ready to copy and publish.
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: prompt
    });

    const outputText =
      response.output_text ||
      (response.output?.[0]?.content?.[0]?.text ?? "");

    return res.json({
      ok: true,
      output: outputText || ""
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error"
    });
  }
}