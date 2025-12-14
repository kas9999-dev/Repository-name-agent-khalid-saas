// backend/server.js (Production-ready for Demo Deploy on Render/Railway)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

/**
 * CORS (Demo-safe)
 * - If FRONTEND_ORIGIN is set (e.g. https://your-landing.netlify.app), allow only that origin.
 * - Otherwise allow all (OK for private demo, but tighten for production).
 */
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").trim();
app.use(
  cors(
    FRONTEND_ORIGIN
      ? { origin: FRONTEND_ORIGIN, methods: ["GET", "POST"], credentials: false }
      : undefined
  )
);

app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend as static (single deploy: backend + frontend together)
app.use(express.static(path.join(__dirname, "../frontend")));

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) return null;
  return String(v).trim();
}

async function callOpenAI({ system, user }) {
  const apiKey = requireEnv("OPENAI_API_KEY");
  if (!apiKey) {
    const err = new Error("Missing OPENAI_API_KEY");
    err.code = "MISSING_KEY";
    throw err;
  }

  // Ensure fetch exists (Node 18+)
  if (typeof fetch !== "function") {
    const err = new Error(
      "Missing global fetch. Please run on Node.js 18+ (recommended: Node 20/22)."
    );
    err.code = "NO_FETCH";
    throw err;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `OpenAI error (status ${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

/** ---------------------------
 * Prompt builders
 * -------------------------- */
function buildSystemPrompt() {
  return [
    "أنت محرّك كتابة محتوى احترافي متعدد المنصات.",
    "اكتب بالعربية الفصحى السلسة، وبأسلوب واضح، وبلا مبالغة ولا ادعاءات غير قابلة للتحقق.",
    "لا تخترع أخبارًا أو أرقامًا أو مصادر.",
    "قدّم مخرجات جاهزة للنشر، مع تقسيم مناسب للمنصة.",
    "عند صياغة X اجعلها أقصر وأكثر مباشرة.",
    "عند صياغة LinkedIn اجعلها أعمق مع تقسيم فقرات.",
    "عند صياغة Instagram اجعلها سهلة القراءة ويمكن إضافة نقاط/سطرين بين كل فقرة.",
  ].join("\n");
}

function normalizeTone(tone) {
  const t = String(tone || "").trim().toLowerCase();
  if (!t) return "احترافية";
  if (t === "professional") return "احترافية";
  if (t === "executive") return "تنفيذية (C-level)";
  if (t === "friendly") return "ودّية";
  if (t === "educational") return "تثقيفية";
  return tone;
}

function normalizePlatform(p) {
  const v = String(p || "").trim().toLowerCase();
  if (!v || v === "all" || v === "both") return "all";
  if (v === "linkedin") return "linkedin";
  if (v === "x" || v === "twitter") return "x";
  if (v === "instagram" || v === "ig") return "instagram";
  return "all";
}

function buildUserPromptForGenerate({ idea, tone, platform }) {
  const toneAr = normalizeTone(tone);
  const p = normalizePlatform(platform);

  const platformInstruction =
    p === "linkedin"
      ? "اكتب نسخة واحدة مخصصة لـ LinkedIn."
      : p === "x"
      ? "اكتب نسخة واحدة مخصصة لـ X (Twitter)."
      : p === "instagram"
      ? "اكتب نسخة واحدة مخصصة لـ Instagram."
      : "اكتب 3 نسخ منفصلة: LinkedIn ثم X ثم Instagram.";

  return [
    `النبرة: ${toneAr}`,
    "",
    "المطلوب:",
    `- ${platformInstruction}`,
    "- اكتب المحتوى جاهز للنشر مباشرة.",
    "- أضف CTA خفيف مناسب (سطر واحد).",
    "- أضف هاشتاقات: (LinkedIn 3-5) و (X/Instagram 5-10).",
    "",
    "الفكرة:",
    String(idea || "").trim(),
    "",
    "تنسيق الإخراج (مهم جدًا):",
    "- إذا كان المطلوب 3 نسخ: اكتب العناوين التالية حرفيًا:",
    "  🟦 LinkedIn",
    "  ⬛ X",
    "  🟪 Instagram",
    "ثم تحت كل عنوان النص الخاص به.",
  ].join("\n");
}

// Legacy /api/run prompt (keep)
function buildUserPrompt(payload) {
  const { mode, platform, tone, audience, text, trendAngle } = payload || {};
  const clean = (v) => (v ? String(v).trim() : "");

  return [
    `وضع التشغيل: ${clean(mode) || "Post Generator"}`,
    `المنصة: ${clean(platform) || "Both"}`,
    `النبرة: ${clean(tone) || "احترافية"}`,
    `الجمهور: ${clean(audience) || "عام"}`,
    trendAngle ? `زاوية الترند/الربط (اختياري): ${clean(trendAngle)}` : "",
    "",
    "المطلوب:",
    "- اكتب المحتوى النهائي المناسب بحسب وضع التشغيل والمنصة.",
    "- إذا كانت المنصة Both: أعطني نسختين منفصلتين: LinkedIn ثم X.",
    "- أضف (اختياريًا) 5–10 هاشتاقات مناسبة إذا كانت المنصة تتطلب ذلك (X/Instagram).",
    "",
    "النص/الفكرة:",
    clean(text || ""),
  ]
    .filter(Boolean)
    .join("\n");
}

/** ---------------------------
 * Routes
 * -------------------------- */

// Health check (useful on Render/Railway)
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * ✅ NEW: Endpoint expected by the updated frontend
 * POST /api/generate
 * body: { idea: string, tone?: string, platform?: 'linkedin'|'x'|'instagram'|'all' }
 */
app.post("/api/generate", async (req, res) => {
  try {
    const { idea, tone, platform } = req.body || {};
    if (!idea || !String(idea).trim()) {
      return res.status(400).json({ ok: false, error: "Missing idea" });
    }

    const output = await callOpenAI({
      system: buildSystemPrompt(),
      user: buildUserPromptForGenerate({ idea, tone, platform }),
    });

    // نرجّع output كنص (الـ frontend سيتعامل معه مباشرة)
    res.json({ ok: true, output });
  } catch (e) {
    const msg =
      e?.code === "MISSING_KEY"
        ? "Missing OPENAI_API_KEY"
        : e?.code === "NO_FETCH"
        ? "Server needs Node.js 18+"
        : e?.message || "Unknown error";

    res.status(e?.status || 500).json({ ok: false, error: msg });
  }
});

// Main run (legacy, keep)
app.post("/api/run", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.text || !String(payload.text).trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const output = await callOpenAI({
      system: buildSystemPrompt(),
      user: buildUserPrompt(payload),
    });

    res.json({ ok: true, output });
  } catch (e) {
    const msg =
      e?.code === "MISSING_KEY"
        ? "Missing OPENAI_API_KEY"
        : e?.code === "NO_FETCH"
        ? "Server needs Node.js 18+"
        : e?.message || "Unknown error";

    res.status(e?.status || 500).json({ ok: false, error: msg });
  }
});

// Suggest trend angle
app.post("/api/suggest-trend", async (req, res) => {
  try {
    const { platform, text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const system = [
      "أنت مساعد يقترح زاوية 'ترند' ذكية وأخلاقية للمحتوى.",
      "لا تخترع أخبارًا ولا تذكر أرقامًا غير مؤكدة.",
      "اقترح زاوية قصيرة (سطر واحد) يمكن لصاحب المحتوى وضعها في خانة الترند.",
    ].join("\n");

    const user = [
      `المنصة: ${platform || "Both"}`,
      "أعطني 3 زوايا مقترحة (كل زاوية سطر واحد فقط) لربط الفكرة بترند عام (بدون ذكر أخبار محددة).",
      "",
      `الفكرة: ${String(text).trim()}`,
    ].join("\n");

    const suggestion = await callOpenAI({ system, user });
    res.json({ ok: true, suggestion });
  } catch (e) {
    const msg =
      e?.code === "MISSING_KEY"
        ? "Missing OPENAI_API_KEY"
        : e?.code === "NO_FETCH"
        ? "Server needs Node.js 18+"
        : e?.message || "Unknown error";

    res.status(e?.status || 500).json({ ok: false, error: msg });
  }
});

// SPA fallback (keep last)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = Number(process.env.PORT || 3000);
// Bind to 0.0.0.0 for cloud runtimes
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Nashr server running on port ${PORT}`);
});