import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- ESM dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Frontend absolute dir ---
const frontendDir = path.resolve(__dirname, "../frontend");
const landingFile = path.join(frontendDir, "landing.html");
const appFile = path.join(frontendDir, "app.html");

// Serve frontend static files (css/js/assets)
app.use(express.static(frontendDir));

// Health
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "Nashr" });
});

// Routes
app.get("/", (req, res) => res.sendFile(landingFile));
app.get("/app", (req, res) => res.sendFile(appFile));

// (اختياري) لو أحد فتح /app/ أو أي مسار آخر بالغلط
app.get("/app/", (req, res) => res.redirect("/app"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});