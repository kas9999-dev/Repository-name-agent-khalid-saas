// backend/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRun from "./api-run.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..");

app.use(express.static(path.join(root, "frontend")));

app.get("/", (req, res) => res.redirect("/app"));
app.get("/app", (req, res) => res.sendFile(path.join(root, "frontend", "app.html")));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Nashr",
    api: "/api/run",
    hasKey: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini"
  });
});

app.post("/api/run", (req, res) => apiRun(req, res));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Nashr running on :${port}`));