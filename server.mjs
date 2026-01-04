import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

/* ================================
   Runtime Sentinel (authoritative)
   ================================ */
const sentinel = spawnSync(
  "node",
  ["scripts/runtime-sentinel.js", "check", "ace-intake", String(PORT)],
  { stdio: "inherit" }
);

if (sentinel.status !== 0) {
  process.exit(1);
}

/* ================================
   Paths
   ================================ */
const DATA_DIR = path.join(__dirname, "data");
const EVENT_LOG_PATH = path.join(DATA_DIR, "ace.event-log.json");

/* ================================
   Helpers
   ================================ */
function nowUtcIso() {
  return new Date().toISOString();
}

function extractUrls(text) {
  const regex = /(https?:\/\/[^\s]+)/g;
  return text.match(regex) ?? [];
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(
    res,
    status,
    { "Content-Type": "application/json; charset=utf-8" },
    JSON.stringify(obj, null, 2)
  );
}

async function appendEvent(event) {
  const reset = {
    kind: "ace_runtime_event_log",
    version: "1.0.0",
    created_utc: nowUtcIso(),
    events: [event]
  };

  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(reset, null, 2), "utf8");
}

/* ================================
   Server
   ================================ */
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true, time_utc: nowUtcIso() });
      return;
    }

    if (req.method === "POST" && req.url === "/api/message") {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", async () => {
        const parsed = JSON.parse(body);
        const messageText = String(parsed.message ?? "").trim();

        if (!messageText) {
          sendJson(res, 400, { ok: false, error: "empty_message" });
          return;
        }

        const message = {
          id: crypto.randomUUID(),
          created_utc: nowUtcIso(),
          text: messageText,
          urls: extractUrls(messageText),
          trust: { score: 0, signals: [] },
          provenance: {
            channel: "public",
            engine: "ace-intake",
            sealed: false
          }
        };

        await appendEvent(message);
        sendJson(res, 200, { ok: true, id: message.id });
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

/* ================================
   Listen
   ================================ */
server.listen(PORT, "127.0.0.1");
console.log(`ACE intake listening on http://127.0.0.1:${PORT}`);
