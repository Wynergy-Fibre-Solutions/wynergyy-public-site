import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SERVICE = "ace-intake";
const LOCK_PATH = path.join(__dirname, "data/runtime", `${SERVICE}.lock.json`);

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
const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
lock.pid = process.pid;
lock.started_utc = new Date().toISOString();
fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2));

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

function appendEvent(event) {
  const payload = {
    kind: "ace_runtime_event_log",
    version: "1.0.0",
    created_utc: nowUtcIso(),
    events: [event]
  };
  fs.writeFileSync(
    path.join(__dirname, "data", "ace.event-log.json"),
    JSON.stringify(payload, null, 2)
  );
}

/* ================================
   Server
   ================================ */
const server = http.createServer((req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true, time_utc: nowUtcIso() });
      return;
    }

    if (req.method === "POST" && req.url === "/api/message") {
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", () => {
        const text = String(JSON.parse(body).message ?? "").trim();
        if (!text) {
          sendJson(res, 400, { ok: false, error: "empty_message" });
          return;
        }

        const msg = {
          id: crypto.randomUUID(),
          created_utc: nowUtcIso(),
          text,
          urls: extractUrls(text),
          provenance: { channel: "public", engine: SERVICE, sealed: false }
        };

        appendEvent(msg);
        sendJson(res, 200, { ok: true, id: msg.id });
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

/* ================================
   Lifecycle cleanup
   ================================ */
function shutdown(reason) {
  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
  }
  console.log(`ACE shutdown (${reason})`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", () => shutdown("exit"));

server.on("error", err => {
  console.error("server error:", err.message);
  shutdown("error");
});

/* ================================
   Listen
   ================================ */
server.listen(PORT, "127.0.0.1", () => {
  console.log(`ACE intake listening on http://127.0.0.1:${PORT}`);
});
