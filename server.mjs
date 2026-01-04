import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";

const ROOT = process.cwd();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const RUNTIME_DIR = join(ROOT, "data", "runtime");
const EVENT_LOG_PATH = join(RUNTIME_DIR, "ace.event-log.runtime.json");

function nowUtcIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function ensureRuntimeStore() {
  if (!existsSync(RUNTIME_DIR)) {
    await mkdir(RUNTIME_DIR, { recursive: true });
  }
  if (!existsSync(EVENT_LOG_PATH)) {
    await writeFile(
      EVENT_LOG_PATH,
      JSON.stringify(
        {
          kind: "ace_runtime_event_log",
          version: "1.0.0",
          created_utc: nowUtcIso(),
          events: []
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

async function appendEvent(event) {
  await ensureRuntimeStore();
  const raw = await readFile(EVENT_LOG_PATH, "utf8");
  const parsed = safeJsonParse(raw);
  const log = parsed.ok && Array.isArray(parsed.value.events)
    ? parsed.value
    : { kind: "ace_runtime_event_log", version: "1.0.0", created_utc: nowUtcIso(), events: [] };

  log.events.push(event);
  await writeFile(EVENT_LOG_PATH, JSON.stringify(log, null, 2), "utf8");
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

function collectBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) reject(new Error("body_too_large"));
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function normaliseMessage(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return null;
  if (text.length > 2000) return null;
  return text;
}

function extractUrls(text) {
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  return Array.from(new Set((text.match(re) || []).map(u => {
    try { return new URL(u).toString(); } catch { return null; }
  }).filter(Boolean))).slice(0, 10);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true, time_utc: nowUtcIso() });
      return;
    }

    if (url.pathname === "/api/message" && req.method === "POST") {
      const raw = await collectBody(req);
      const parsed = safeJsonParse(raw);
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, error: "invalid_json" });
        return;
      }

      const messageText = normaliseMessage(parsed.value?.message);
      if (!messageText) {
        sendJson(res, 400, { ok: false, error: "invalid_message" });
        return;
      }

      const message = {
        kind: "ace_public_message",
        version: "1.0.0",
        id: randomUUID(),
        time_utc: nowUtcIso(),
        source: "public_site",
        message: messageText,
        urls: extractUrls(messageText),
        trust: {
          score: 0,
          signals: []
        },
        provenance: {
          channel: "public",
          engine: "ace-intake",
          sealed: false
        }
      };

      await appendEvent(message);

      sendJson(res, 200, { ok: true, id: message.id });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

server.listen(PORT, "127.0.0.1");
console.log(`ACE intake listening on http://127.0.0.1:${PORT}`);
