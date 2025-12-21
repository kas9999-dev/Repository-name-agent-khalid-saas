import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Resolve paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");

// ===== Middleware =====
app.use(express.json());

// ===== Serve frontend static =====
app.use(express.static(frontendPath));

// ===== Routes =====
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "landing.html"));
});

app.get("/app", (req, res) => {
  res.sendFile(path.join(frontendPath, "app.html"));
});

// ===== Health check =====
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "Nashr" });
});

// ===== API placeholder (لو api-run.js موجود =====
// import "./api-run.js";  ← لو أنت تستخدمه فعليًا

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`✅ Nashr server running on port ${PORT}`);
});