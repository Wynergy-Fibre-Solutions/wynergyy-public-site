// FILE: C:\Users\Paul Wynn\github\wynergyy-public-site\server.mjs
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = "127.0.0.1";
const PORT = 3000;

const SERVICE = "ace-intake";
const DATA_DIR = path.join(__dirname, "data");
const RUNTIME_DIR = path.join(DATA_DIR, "runtime");
const LOCK_PATH = path.join(RUNTIME_DIR, `${SERVICE}.lock.json`);
const EVENT_LOG_PATH = path.join(DATA_DIR, "ace.event-log.json");

/* ================================
   Runtime Sentinel
   ================================ */
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

ensureDirs();

const sentinel = spawnSync(
  "node",
  ["scripts/runtime-sentinel.js", "check", SERVICE, String(PORT)],
  { stdio: "inherit" }
);

if (sentinel.status !== 0) {
  process.exit(1);
}

/* ================================
   Claim ownership
   ================================ */
function claimLock() {
  const base = {
    service: SERVICE,
    host: HOST,
    port: PORT,
    pid: process.pid,
    started_utc: new Date().toISOString()
  };
  fs.writeFileSync(LOCK_PATH, JSON.stringify(base, null, 2));
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch {
    // no-op
  }
}

claimLock();

/* ================================
   Helpers
   ================================ */
function nowUtcIso() {
  return new Date().toISOString();
}

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s]+/g) ?? [];
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj, null, 2));
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function appendKernelEvent(event) {
  const current = readJsonSafe(EVENT_LOG_PATH, {
    kind: "ace_runtime_event_log",
    version: "1.0.0",
    created_utc: nowUtcIso(),
    events: []
  });

  if (!current.created_utc) current.created_utc = nowUtcIso();
  if (!Array.isArray(current.events)) current.events = [];

  current.events.push(event);
  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(current, null, 2));
}

function parseBodyJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      try {
        const obj = JSON.parse(body || "{}");
        resolve(obj);
      } catch {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", () => reject(new Error("body_error")));
  });
}

function makeKernelEvent({ type, actor, subject, text, urls, payload }) {
  return {
    kind: "kernel.event",
    version: "1.0.0",
    id: crypto.randomUUID(),
    created_utc: nowUtcIso(),
    type,
    actor: actor ?? "system",
    subject: subject ?? "unspecified",
    text: text ?? "",
    urls: urls ?? [],
    payload: payload ?? {},
    provenance: {
      engine: SERVICE,
      channel: "local",
      sealed: false
    }
  };
}

/* ================================
   Server
   ================================ */
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        time_utc: nowUtcIso(),
        service: SERVICE,
        pid: process.pid
      });
      return;
    }

    // Kernel Federation endpoint (authoritative event intake)
    if (req.method === "POST" && req.url === "/api/kernel/event") {
      let body;
      try {
        body = await parseBodyJson(req);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
        return;
      }

      const type = String(body.type ?? "").trim();
      const actor = String(body.actor ?? "system").trim();
      const subject = String(body.subject ?? "unspecified").trim();
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const payload = typeof body.payload === "object" && body.payload ? body.payload : {};

      if (!type) {
        sendJson(res, 400, { ok: false, error: "missing_type" });
        return;
      }
      if (type.length > 120) {
        sendJson(res, 400, { ok: false, error: "type_too_long" });
        return;
      }
      if (text.length > 4000) {
        sendJson(res, 400, { ok: false, error: "text_too_long" });
        return;
      }

      const event = makeKernelEvent({
        type,
        actor,
        subject,
        text,
        urls: extractUrls(text),
        payload
      });

      appendKernelEvent(event);
      sendJson(res, 200, { ok: true, id: event.id });
      return;
    }

    // Compatibility intake (wraps message into kernel.event)
    if (req.method === "POST" && req.url === "/api/message") {
      let body;
      try {
        body = await parseBodyJson(req);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
        return;
      }

      const text = typeof body.message === "string" ? body.message.trim() : "";
      if (!text) {
        sendJson(res, 400, { ok: false, error: "empty_message" });
        return;
      }
      if (text.length > 4000) {
        sendJson(res, 400, { ok: false, error: "message_too_long" });
        return;
      }

      const event = makeKernelEvent({
        type: "ace.message",
        actor: "public",
        subject: "message",
        text,
        urls: extractUrls(text),
        payload: { schema: "ace.message" }
      });

      appendKernelEvent(event);
      sendJson(res, 200, { ok: true, id: event.id });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

/* ================================
   Lifecycle cleanup (deterministic)
   ================================ */
let shuttingDown = false;

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    server.close(() => {
      releaseLock();
      console.log(`ACE shutdown (${reason})`);
      process.exit(0);
    });

    // safety net: if close never fires
    setTimeout(() => {
      releaseLock();
      console.log(`ACE shutdown timeout (${reason})`);
      process.exit(0);
    }, 1500);
  } catch {
    releaseLock();
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("error", err => {
  console.error("server error:", err.message);
  shutdown("error");
});

/* ================================
   Listen
   ================================ */
server.listen(PORT, HOST, () => {
  console.log(`ACE intake listening on http://${HOST}:${PORT}`);
});
