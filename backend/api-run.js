import OpenAI from "openai";

const X_MAX = 280;

function extractXSection(fullText) {
  // نحاول نلقط قسم X بعد "X:" أو "X" أو "Twitter"
  const t = String(fullText || "").trim();

  // 1) نمط: "X:" في سطر
  let m =
    t.match(/\n?X\s*:\s*\n([\s\S]*?)$/i) ||
    t.match(/\n?X\s*\n([\s\S]*?)$/i) ||
    t.match(/\n?Twitter\s*:\s*\n([\s\S]*?)$/i);

  if (m && m[1]) return m[1].trim();

  // 2) إذا النص كله يبدو قصير (ربما X فقط)
  return t;
}

function replaceXSection(fullText, newX) {
  const t = String(fullText || "").trim();

  // لو عندنا "X:" نستبدل ما بعده
  if (/(\n?X\s*:\s*\n)/i.test(t)) {
    return t.replace(/(\n?X\s*:\s*\n)([\s\S]*?)$/i, `$1${newX.trim()}`);
  }

  // لو عندنا "X" كسطر
  if (/(\n?X\s*\n)/i.test(t)) {
    return t.replace(/(\n?X\s*\n)([\s\S]*?)$/i, `$1${newX.trim()}`);
  }

  // لو لا، نخليه كما هو (غالبًا X فقط)
  return newX.trim();
}

function hardCutToMaxChars(str, maxChars) {
  const s = String(str || "").trim();
  if (s.length <= maxChars) return s;
  // قصّ آمن بدون كسر كبير: نحاول نقص عند آخر فاصلة/نقطة/مسافة قبل الحد
  const slice = s.slice(0, maxChars);
  const cutAt = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("،"),
    slice.lastIndexOf("."),
    slice.lastIndexOf("؛"),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?")
  );
  const out = (cutAt > 120 ? slice.slice(0, cutAt) : slice).trim();
  return out.length <= maxChars ? out : slice.trim();
}

export default async function apiRun(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY (set it in Render Environment Variables)."
      });
    }

    const client = new OpenAI({ apiKey });

    const {
      text,
      platform = "Both",
      tone = "احترافية",
      audience = "رواد الأعمال"
    } = req.body || {};

    const inputText = String(text || "").trim();
    if (!inputText) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    // ======================
    // Prompt (STRICT VERSION)
    // ======================
    const prompt = `
أنت مساعد كتابة محتوى احترافي متخصص في منصات التواصل الاجتماعي.

اكتب محتوى جاهز للنشر وفق البيانات التالية:

Platform: ${platform}
Tone: ${tone}
Audience: ${audience}

الفكرة / الموضوع:
${inputText}

قواعد الإخراج (إلزامية):
- لا تكتب أي شرح تقني أو ملاحظات خارج النص النهائي.
- النص يجب أن يكون جاهزًا للنشر والنسخ مباشرة.

إذا Platform = Both:
1) LinkedIn:
   - محتوى احترافي غني.
   - منسق بفقرات أو نقاط واضحة.
   - مناسب للنشر على LinkedIn.

2) X (Twitter):
   - لا يتجاوز 280 حرفًا (شرط إلزامي).
   - فكرة واحدة واضحة ومباشرة.
   - بدون فقرات طويلة أو ترقيم مطوّل.
   - يمكن إضافة هاشتاق أو اثنين كحد أقصى.

إذا Platform = X فقط:
- النص يجب أن يكون ≤ 280 حرفًا.
- فكرة واحدة فقط.

إذا Platform = LinkedIn فقط:
- محتوى احترافي مفصّل نسبيًا.
- منظم وسهل القراءة.

أخرج النتيجة بالنص النهائي فقط.
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: prompt
    });

    let outputText =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    outputText = String(outputText || "").trim();
    if (!outputText) {
      return res.status(500).json({ ok: false, error: "Empty output from model" });
    }

    // ======================
    // Fail-safe for X length
    // ======================
    const needX = platform === "X" || platform === "Both";
    if (needX) {
      const xText = extractXSection(outputText);
      if (xText.length > X_MAX) {
        // محاولة اختصار واحدة بالموديل
        const tightenPrompt = `
اختصر النص التالي ليصبح مناسبًا للنشر على X بشرط صارم:
- لا يتجاوز ${X_MAX} حرفًا (إلزامي).
- حافظ على نفس الفكرة الأساسية.
- جملة/جملتين كحد أقصى.
- هاشتاق واحد أو اثنين كحد أقصى (اختياري).
- أخرج النص النهائي فقط بدون شرح.

النص:
${xText}
`.trim();

        const resp2 = await client.responses.create({
          model,
          input: tightenPrompt
        });

        let shorter =
          resp2.output_text ||
          resp2.output?.[0]?.content?.[0]?.text ||
          "";

        shorter = String(shorter || "").trim();
        if (!shorter) shorter = xText;

        // قصّ نهائي (نادر) إذا بقي أطول من 280
        if (shorter.length > X_MAX) {
          shorter = hardCutToMaxChars(shorter, X_MAX);
        }

        // استبدال قسم X داخل الناتج الكلي
        outputText = replaceXSection(outputText, shorter);
      }
    }

    return res.json({
      ok: true,
      output: outputText
    });

  } catch (err) {
    console.error("api-run error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown server error"
    });
  }
}