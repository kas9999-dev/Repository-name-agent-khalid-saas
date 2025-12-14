// backend/server.js
// Production-ready server for Nashr (Landing + App)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

/* ===============================
   Basic setup
================================ */

app.use(express.json({ limit: "2mb" }));

const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").trim();

app.use(
  cors(
    FRONTEND_ORIGIN
      ? { origin: FRONTEND_ORIGIN, methods: ["GET", "POST"] }
      : undefined
  )
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.join(__dirname, "../frontend");

/* ===============================
   Static assets (CSS / JS / images)
   IMPORTANT: no index.html auto-serve
================================ */

app.use(express.static(FRONTEND_DIR));

/* ===============================
   Helpers
================================ */

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

  if (typeof fetch !== "function") {
    throw new Error("Node 18+ required (fetch not available)");
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

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "OpenAI error");
  }

  return data?.choices?.[0]?.message?.content || "";
}

function buildSystemPrompt() {
  return [
    "أنت محرّك كتابة محتوى احترافي متعدد المنصات.",
    "اكتب بالعربية الفصحى الواضحة بدون مبالغة.",
    "قدّم مخرجات جاهزة للنشر.",
  ].join("\n");
}

function buildUserPrompt(payload) {
  const { platform, text } = payload || {};

  return [
    `المنصة: ${platform || "LinkedIn"}`,
    "",
    "النص:",
    text || "",
  ].join("\n");
}

/* ===============================
   API Routes
================================ */

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Generate content
app.post("/api/run", async (req, res) => {
  try {
    if (!req.body?.text) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const output = await callOpenAI({
      system: buildSystemPrompt(),
      user: buildUserPrompt(req.body),
    });

    res.json({ ok: true, output });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message || "Server error",
    });
  }
});

/* ===============================
   Pages Routing (IMPORTANT)
================================ */

// Landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "landing.html"));
});

// App page
app.get("/app", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "app.html"));
});

// Fallback → Landing
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "landing.html"));
});

/* ===============================
   Server start
================================ */

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Nashr server running on port ${PORT}`);
});