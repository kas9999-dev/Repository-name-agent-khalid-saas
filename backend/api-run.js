import OpenAI from "openai";

/**
 * Helper: clip text to maxChars (X = 280)
 */
function clipTo(text, maxChars) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1).trimEnd() + "…";
}

/**
 * Helper: parse tagged blocks like:
 * [X_1]...[/X_1]
 */
function extractTag(text, tag) {
  const re = new RegExp(`\$begin:math:display$\$\{tag\}\\$end:math:display$([\\s\\S]*?)\$begin:math:display$\\\\\/\$\{tag\}\\$end:math:display$`, "i");
  const m = String(text || "").match(re);
  return m ? m[1].trim() : "";
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

    const {
      text,
      platform = "Both",
      tone = "احترافية",
      audience = "رواد الأعمال",
      language = "العربية",
    } = req.body || {};

    const inputText = String(text || "").trim();
    if (!inputText) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    // ✅ Prompt: 3 Hooks for X (<=280) + 3 LinkedIn variations
    const prompt = `
أنت مساعد كتابة محتوى عربي احترافي باسم "Nashr".

المعطيات:
- Platform: ${platform}
- Tone: ${tone}
- Audience: ${audience}
- Language: ${language}

الفكرة/الموضوع:
${inputText}

المطلوب (مهم جدًا):
1) اكتب 3 نسخ لـ LinkedIn (A/B/C) — كل نسخة مختلفة قليلًا في الصياغة والزوايا.
   - تنسيق واضح، فقرات قصيرة، و3–6 نقاط عند الحاجة.
   - اجعلها جاهزة للنشر.

2) اكتب 3 خيارات لـ X (1/2/3):
   - كل خيار يجب ألا يتجاوز 280 حرفًا (حرف = character).
   - كل خيار يكون "Hook" قوي + قيمة + هاشتاقين فقط.
   - لا تضع مقدمة طويلة.

قواعد إخراج صارمة (لا تكسرها):
- أعد الإخراج بهذه الصيغة فقط (بدون أي كلام خارجها):
[LINKEDIN_A]
...النص...
[/LINKEDIN_A]
[LINKEDIN_B]
...النص...
[/LINKEDIN_B]
[LINKEDIN_C]
...النص...
[/LINKEDIN_C]
[X_1]
...النص...
[/X_1]
[X_2]
...النص...
[/X_2]
[X_3]
...النص...
[/X_3]
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const raw =
      response.output_text ||
      (response.output?.[0]?.content?.[0]?.text ?? "") ||
      "";

    // Parse and enforce X length
    const linkedinA = extractTag(raw, "LINKEDIN_A");
    const linkedinB = extractTag(raw, "LINKEDIN_B");
    const linkedinC = extractTag(raw, "LINKEDIN_C");

    const x1 = clipTo(extractTag(raw, "X_1"), 280);
    const x2 = clipTo(extractTag(raw, "X_2"), 280);
    const x3 = clipTo(extractTag(raw, "X_3"), 280);

    const output = {
      linkedin: { A: linkedinA, B: linkedinB, C: linkedinC },
      x: { "1": x1, "2": x2, "3": x3 },
      raw, // optional للتشخيص
    };

    // If something missing, still return raw for debug
    return res.json({ ok: true, output });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error",
    });
  }
}