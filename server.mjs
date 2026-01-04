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
   Directories
================================ */
fs.mkdirSync(RUNTIME_DIR, { recursive: true });

/* ================================
   Runtime Sentinel
================================ */
const sentinel = spawnSync(
  "node",
  ["scripts/runtime-sentinel.js", "check", SERVICE, String(PORT)],
  { stdio: "inherit" }
);

if (sentinel.status !== 0) process.exit(1);

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
const nowUtcIso = () => new Date().toISOString();
const extractUrls = t => t.match(/https?:\/\/[^\s]+/g) ?? [];

function readLog() {
  if (!fs.existsSync(EVENT_LOG_PATH)) {
    return { engine: "ACE", version: "phase-4", events: [] };
  }
  return JSON.parse(fs.readFileSync(EVENT_LOG_PATH, "utf8"));
}

function appendEvent(event) {
  const log = readLog();
  log.events.push(event);
  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(log, null, 2));
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj, null, 2));
}

/* ================================
   Server
================================ */
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    return sendJson(res, 200, { ok: true, pid: process.pid, time_utc: nowUtcIso() });
  }

  if (req.method === "POST" && req.url === "/api/kernel/event") {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => {
      const input = JSON.parse(body || "{}");
      if (!input.type) return sendJson(res, 400, { ok: false });

      const event = {
        id: crypto.randomUUID(),
        type: input.type,
        actor: input.actor ?? "system",
        subject: input.subject ?? "unknown",
        text: input.text ?? "",
        urls: extractUrls(input.text ?? ""),
        payload: input.payload ?? {},
        created_utc: nowUtcIso()
      };

      appendEvent(event);
      sendJson(res, 200, { ok: true, id: event.id });
    });
    return;
  }

  sendJson(res, 404, { ok: false });
});

/* ================================
   Shutdown (safe)
================================ */
function cleanup(reason) {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch {}
  console.log(`ACE shutdown (${reason})`);
}

process.on("SIGINT", () => cleanup("SIGINT"));
process.on("SIGTERM", () => cleanup("SIGTERM"));

/* ================================
   Listen
================================ */
server.listen(PORT, HOST, () => {
  console.log(`ACE intake listening on http://${HOST}:${PORT}`);
});
