// backend/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import apiRun from "./api-run.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ===============================
   🔒 Preview Access Gate (GLOBAL)
   MUST be before static
================================== */

function decodeBasicAuth(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  const b64 = header.slice("Basic ".length).trim();
  const raw = Buffer.from(b64, "base64").toString("utf8");
  const idx = raw.indexOf(":");
  if (idx === -1) return null;
  return { user: raw.slice(0, idx), pass: raw.slice(idx + 1) };
}

function unauthorized(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Nashr Preview"');
  return res.status(401).send("Preview access requires authentication.");
}

const REQUIRE_PREVIEW_AUTH =
  (process.env.REQUIRE_PREVIEW_AUTH || "").toLowerCase() === "true";

const PREVIEW_USER = process.env.PREVIEW_USER || "";
const PREVIEW_PASS = process.env.PREVIEW_PASS || "";

if (REQUIRE_PREVIEW_AUTH) {
  app.use((req, res, next) => {
    // health check فقط بدون باسورد
    if (req.path === "/health") return next();

    const creds = decodeBasicAuth(req.headers.authorization);
    if (!creds) return unauthorized(res);

    if (
      creds.user === PREVIEW_USER &&
      creds.pass === PREVIEW_PASS
    ) {
      return next();
    }

    return unauthorized(res);
  });
}

/* ===============================
   📂 Static Frontend (NOW PROTECTED)
================================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..");

app.use(express.static(path.join(root, "frontend")));

/* ===============================
   🌐 Routes
================================== */

app.get("/", (req, res) =>
  res.sendFile(path.join(root, "frontend", "landing.html"))
);

app.get("/app", (req, res) =>
  res.sendFile(path.join(root, "frontend", "app.html"))
);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Nashr",
    previewAuth: REQUIRE_PREVIEW_AUTH
  });
});

app.post("/api/run", (req, res) => apiRun(req, res));

/* ===============================
   🚀 Server
================================== */

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Nashr running on :${port}`)
);