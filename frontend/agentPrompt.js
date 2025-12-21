/* =========================================================
   Nashr — Strategic Presence Engine (v1)
   File: frontend/agentPrompt.js
   Purpose:
   - تحويل "توليد منشور" إلى نظام حضور استراتيجي:
     أسلوب + هدف زمني/غير زمني + سلسلة + ردود + ترند + شريحة
========================================================= */

/**
 * buildNashrPrompt(input)
 * Returns a single prompt string that the backend sends to the model.
 *
 * Expected input shape (safe defaults inside):
 * {
 *   idea: string,
 *   platform: "LinkedIn + X" | "X" | "LinkedIn" | string,
 *   tone: string,
 *   audience: string,
 *   language: "العربية" | "English" | "AR" | "EN" | string,
 *   // Strategic additions:
 *   mode: "post" | "series" | "reply" | "campaign" | "ad",
 *   goal: string,                 // goal statement
 *   goalHorizon: "none"|"2w"|"1m"|"45d"|"2m",  // none = محتوى الآن بدون مدة
 *   seriesCount: number,          // for series mode
 *   styleProfile: {
 *     voiceName?: string,         // "Khalid" style, etc
 *     bio?: string,
 *     topics?: string[],
 *     do?: string[],
 *     dont?: string[],
 *     signaturePhrases?: string[],
 *     keywords?: string[],
 *     writingSamples?: string[]   // optional: paste old posts
 *   },
 *   trendContext: {
 *     trends?: string[],          // provided manually for now
 *     recommendationRule?: string // optional
 *   }
 * }
 */

export function buildNashrPrompt(input = {}) {
  const safe = (v, d = "") => (typeof v === "string" ? v.trim() : d);
  const safeArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  const clampInt = (n, d, min, max) => {
    const x = Number.isFinite(Number(n)) ? parseInt(n, 10) : d;
    return Math.max(min, Math.min(max, x));
  };

  const idea = safe(input.idea, "");
  const platform = safe(input.platform, "LinkedIn + X");
  const tone = safe(input.tone, "احترافية");
  const audience = safe(input.audience, "رواد الأعمال");
  const languageRaw = safe(input.language, "العربية");

  const mode = safe(input.mode, "post"); // post | series | reply | campaign | ad
  const goal = safe(input.goal, "");
  const goalHorizon = safe(input.goalHorizon, "none"); // none|2w|1m|45d|2m
  const seriesCount = clampInt(input.seriesCount, 5, 2, 12);

  const sp = input.styleProfile || {};
  const styleProfile = {
    voiceName: safe(sp.voiceName, "Khalid"),
    bio: safe(sp.bio, ""),
    topics: safeArr(sp.topics),
    do: safeArr(sp.do),
    dont: safeArr(sp.dont),
    signaturePhrases: safeArr(sp.signaturePhrases),
    keywords: safeArr(sp.keywords),
    writingSamples: safeArr(sp.writingSamples),
  };

  const tc = input.trendContext || {};
  const trendContext = {
    trends: safeArr(tc.trends),
    recommendationRule: safe(tc.recommendationRule, ""),
  };

  const lang = normalizeLang(languageRaw); // "ar" | "en"
  const horizonText = horizonToText(goalHorizon, lang);

  // --- Output contract: JSON only ---
  // backend/api-run.js currently expects { x, linkedin, language }
  // We'll keep that + add extra fields safely (backend can ignore).
  const outputContract = `
OUTPUT FORMAT (STRICT):
Return ONLY valid JSON (no markdown, no backticks, no commentary) with this shape:

{
  "ok": true,
  "language": "${lang}",
  "platform": "${platform}",
  "mode": "${mode}",
  "strategic": {
    "goal": "<string or empty>",
    "goalHorizon": "${goalHorizon}",
    "goalHorizonText": "${escapeForJson(horizonText)}",
    "audience": "${escapeForJson(audience)}",
    "tone": "${escapeForJson(tone)}",
    "valueAngle": "<1 line: value proposition angle>",
    "cta": "<1 short CTA line>"
  },
  "x": "<X post (max 280 chars) OR for series: a numbered list of posts each <= 280>",
  "linkedin": "<LinkedIn post (1-2 short paragraphs + bullets if needed) OR for series: separate posts with separators>",
  "series": [
    {
      "day": 1,
      "title": "<short>",
      "x": "<<=280>",
      "linkedin": "<post>"
    }
  ],
  "replies": [
    {
      "scenario": "<what comment/question we reply to>",
      "reply": "<reply text>"
    }
  ],
  "trend": {
    "suggested": "<trend name or empty>",
    "recommendation": "JOIN|SKIP|ADAPT",
    "why": "<1-2 lines>"
  },
  "notes": {
    "styleMatched": "<what elements matched the style profile>",
    "howToImprove": "<1-2 practical suggestions>"
  }
}

Rules:
- JSON must be parseable.
- For mode="post": you may keep series/replies arrays empty.
- For mode="series": fill "series" with ${seriesCount} items and set "x"/"linkedin" to a compact summary.
- For platform="X": still return linkedin but you can keep it shorter; same for LinkedIn.
- X: enforce <= 280 chars for each X post.
`;

  // --- Strategic brain instructions ---
  const systemBrain = `
You are Nashr (Demo) — a Strategic Presence Engine.
Your job is NOT to "write generic AI content".
Your job is to produce platform-ready content that matches a user's voice, aligns with a specific audience, and serves a strategic goal over time.

Core principles:
1) Voice > Text: mimic the user's real style.
2) Strategy > Words: every post should serve a goal (positioning, trust, leads, authority).
3) Audience fit: talk to the selected audience with the selected tone.
4) Platform fit: X concise; LinkedIn deeper.
5) Quality: no fluff, no generic clichés, no filler intros.
6) Brand: start posts with "Nashr |" ONLY when appropriate and not spammy (prefer 1st line hook that can include Nashr branding).
`;

  const memoryBlock = buildMemoryBlock(styleProfile, lang);

  const taskBlock = `
TASK:
Generate content based on:
- Topic/idea: "${escapeForJson(idea)}"
- Platform: "${escapeForJson(platform)}"
- Language: "${lang}"
- Tone: "${escapeForJson(tone)}"
- Audience: "${escapeForJson(audience)}"
- Mode: "${mode}"
- Goal: "${escapeForJson(goal)}"
- Time horizon: "${escapeForJson(horizonText)}"

Mode guidance:
- post: produce 1 strong X + 1 strong LinkedIn
- series: produce ${seriesCount} connected posts (a cohesive series), each with X + LinkedIn variants
- reply: produce reply suggestions (3) to likely comments, in the same voice
- campaign: produce 1 hook post + 1 follow-up post + 1 CTA post (series=3)
- ad: produce ad-style copy (clear offer, trust, CTA) but still consistent with voice

Trend guidance:
- If trend list provided, choose the best match and recommend JOIN/SKIP/ADAPT with reasons.
- If no trends provided, keep trend.suggested empty and give recommendation ADAPT with "need trend input".

Constraints:
- No direct mention that you are an AI.
- Avoid overpromising.
- No fake stats.
- Keep Arabic professional and natural; keep English crisp and professional.
`;

  const trendBlock = buildTrendBlock(trendContext, lang);

  const prompt =
    systemBrain +
    "\n\n" +
    memoryBlock +
    "\n\n" +
    trendBlock +
    "\n\n" +
    taskBlock +
    "\n\n" +
    outputContract;

  return prompt;
}

/* ---------------- Helpers ---------------- */

function normalizeLang(lang) {
  const v = (lang || "").toLowerCase();
  if (v.includes("en") || v.includes("english")) return "en";
  return "ar";
}

function horizonToText(h, lang) {
  const mapAr = {
    none: "بدون إطار زمني — توليد محتوى الآن يخدم الحضور العام.",
    "2w": "هدف خلال أسبوعين (14 يومًا).",
    "1m": "هدف خلال شهر (30 يومًا).",
    "45d": "هدف خلال 45 يومًا.",
    "2m": "هدف خلال شهرين (60 يومًا).",
  };
  const mapEn = {
    none: "No timeframe — generate content for immediate use and general presence.",
    "2w": "Goal within 2 weeks (14 days).",
    "1m": "Goal within 1 month (30 days).",
    "45d": "Goal within 45 days.",
    "2m": "Goal within 2 months (60 days).",
  };
  const key = mapAr[h] ? h : "none";
  return lang === "en" ? mapEn[key] : mapAr[key];
}

function buildMemoryBlock(styleProfile, lang) {
  const lines = [];
  lines.push("VOICE & MEMORY (use as the primary guide):");

  lines.push(`- Voice name: ${styleProfile.voiceName || "Khalid"}`);

  if (styleProfile.bio) lines.push(`- Bio: ${styleProfile.bio}`);

  if (styleProfile.topics.length) {
    lines.push(`- Core topics: ${styleProfile.topics.join(", ")}`);
  } else {
    lines.push(
      lang === "en"
        ? "- Core topics: (not provided) — infer from the idea and audience."
        : "- المواضيع الأساسية: (غير محددة) — استنتج من الفكرة والجمهور."
    );
  }

  if (styleProfile.keywords.length) {
    lines.push(`- Keywords to prefer: ${styleProfile.keywords.join(", ")}`);
  }

  if (styleProfile.signaturePhrases.length) {
    lines.push(`- Signature phrases (sprinkle lightly): ${styleProfile.signaturePhrases.join(" | ")}`);
  }

  if (styleProfile.do.length) {
    lines.push(`- Do: ${styleProfile.do.map((x) => `• ${x}`).join(" ")}`);
  }
  if (styleProfile.dont.length) {
    lines.push(`- Don't: ${styleProfile.dont.map((x) => `• ${x}`).join(" ")}`);
  }

  if (styleProfile.writingSamples.length) {
    lines.push("");
    lines.push("Writing samples (mimic structure, rhythm, and tone; do not copy verbatim):");
    styleProfile.writingSamples.slice(0, 5).forEach((s, i) => {
      lines.push(`Sample ${i + 1}: ${s}`);
    });
  } else {
    lines.push(
      lang === "en"
        ? "- Writing samples: none. Use a confident, strategic, practical consultant voice."
        : "- عينات كتابة: لا يوجد. استخدم صوت مستشار استراتيجي عملي وواثق."
    );
  }

  // Critical guardrail against generic output
  lines.push("");
  lines.push(
    lang === "en"
      ? "Non-negotiable: avoid generic motivational filler; prioritize actionable insights, clear viewpoint, and crisp structure."
      : "شرط أساسي: تجنّب العموميات والتحفيز الفارغ؛ قدّم رأيًا واضحًا ونقاطًا عملية وبنية مختصرة."
  );

  return lines.join("\n");
}

function buildTrendBlock(trendContext, lang) {
  const trends = trendContext.trends || [];
  const rule = trendContext.recommendationRule || "";

  if (!trends.length) {
    return lang === "en"
      ? `TREND INPUT:
- trends: none provided.
- rule: ${rule || "(none)"}
Decision rule: If no trend input, set trend.suggested="", recommendation="ADAPT", and explain we need trend list/source.`
      : `مدخلات الترند:
- الترندات: غير متوفرة.
- القاعدة: ${rule || "(لا يوجد)"}
قاعدة القرار: عند عدم توفر الترند، اجعل trend.suggested فارغًا والتوصية ADAPT ووضح أننا نحتاج قائمة ترندات/مصدر.`;
  }

  return `
TREND INPUT:
- trends: ${trends.join(" | ")}
- rule: ${rule || "(none)"}
Decision rule:
- Choose the closest trend to the idea and audience.
- If it distracts from positioning/goal, recommend SKIP.
- If it can be used to reinforce expertise without chasing hype, recommend ADAPT.
`.trim();
}

function escapeForJson(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}