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
   Runtime preparation
================================ */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });

/* ================================
   Runtime Sentinel
================================ */
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
fs.writeFileSync(
  LOCK_PATH,
  JSON.stringify(
    {
      service: SERVICE,
      host: HOST,
      port: PORT,
      pid: process.pid,
      started_utc: new Date().toISOString()
    },
    null,
    2
  )
);

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

function readEventLog() {
  if (!fs.existsSync(EVENT_LOG_PATH)) {
    return {
      engine: "ACE",
      version: "phase-4",
      created_utc: nowUtcIso(),
      events: []
    };
  }
  return JSON.parse(fs.readFileSync(EVENT_LOG_PATH, "utf8"));
}

function appendEvent(event) {
  const log = readEventLog();
  log.events.push(event);
  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(log, null, 2));
}

function parseJsonBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
  });
}

/* ================================
   Server
================================ */
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE,
        pid: process.pid,
        time_utc: nowUtcIso()
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/kernel/event") {
      const body = await parseJsonBody(req);

      if (!body.type) {
        sendJson(res, 400, { ok: false, error: "missing_type" });
        return;
      }

      const event = {
        id: crypto.randomUUID(),
        kind: "kernel.event",
        type: String(body.type),
        actor: String(body.actor ?? "system"),
        subject: String(body.subject ?? "unspecified"),
        text: String(body.text ?? ""),
        urls: extractUrls(String(body.text ?? "")),
        payload: body.payload ?? {},
        created_utc: nowUtcIso(),
        provenance: {
          engine: SERVICE,
          sealed: false
        }
      };

      appendEvent(event);
      sendJson(res, 200, { ok: true, id: event.id });
      return;
    }

    if (req.method === "POST" && req.url === "/api/message") {
      const body = await parseJsonBody(req);
      const text = String(body.message ?? "").trim();

      if (!text) {
        sendJson(res, 400, { ok: false, error: "empty_message" });
        return;
      }

      const event = {
        id: crypto.randomUUID(),
        kind: "kernel.event",
        type: "ace.message",
        actor: "public",
        subject: "message",
        text,
        urls: extractUrls(text),
        payload: {},
        created_utc: nowUtcIso(),
        provenance: {
          engine: SERVICE,
          sealed: false
        }
      };

      appendEvent(event);
      sendJson(res, 200, { ok: true, id: event.id });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

/* ================================
   Deterministic shutdown
================================ */
function shutdown(reason) {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch {}

  console.log(`ACE shutdown (${reason})`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", () => shutdown("exit"));

server.listen(PORT, HOST, () => {
  console.log(`ACE intake listening on http://${HOST}:${PORT}`);
});
