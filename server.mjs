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
    return { ok: false, value: null };
  }
}

async function ensureRuntimeStore() {
  if (!existsSync(RUNTIME_DIR)) {
    await mkdir(RUNTIME_DIR, { recursive: true });
  }
  if (!existsSync(EVENT_LOG_PATH)) {
    const seed = {
      kind: "ace_runtime_event_log",
      version: "1.0.0",
      created_utc: nowUtcIso(),
      events: []
    };
    await writeFile(EVENT_LOG_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function appendEvent(event) {
  await ensureRuntimeStore();
  const raw = await readFile(EVENT_LOG_PATH, "utf8");
  const parsed = safeJsonParse(raw);
  if (!parsed.ok || !parsed.value || !Array.isArray(parsed.value.events)) {
    const reset = {
      kind: "ace_runtime_event_log",
      version: "1.0.0",
      created_utc: nowUtcIso(),
      events: [event]
    };
    await writeFile(EVENT_LOG_PATH, JSON.stringify(reset, null, 2), "utf8");
    return;
  }
  parsed.value.events.push(event);
  await writeFile(EVENT_LOG_PATH, JSON.stringify(parsed.value, null, 2), "utf8");
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

function sendHtml(res, status, html) {
  send(res, status, { "Content-Type": "text/html; charset=utf-8" }, html);
}

async function readStatic(filePath) {
  return readFile(join(ROOT, filePath), "utf8");
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
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > 2000) return { ok: false, reason: "too_long" };
  return { ok: true, value: text };
}

function extractUrls(text) {
  const urls = [];
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(re) || [];
  for (const m of matches) {
    try {
      urls.push(new URL(m).toString());
    } catch {}
  }
  return Array.from(new Set(urls)).slice(0, 10);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;

    if (path === "/api/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true, time_utc: nowUtcIso() });
      return;
    }

    if (path === "/api/message" && req.method === "POST") {
      const raw = await collectBody(req);
      const parsed = safeJsonParse(raw);
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, error: "invalid_json" });
        return;
      }

      const msg = normaliseMessage(parsed.value?.message);
      if (!msg.ok) {
        sendJson(res, 400, { ok: false, error: msg.reason });
        return;
      }

      const event = {
        id: randomUUID(),
        kind: "public_message_received",
        time_utc: nowUtcIso(),
        message: msg.value,
        urls: extractUrls(msg.value)
      };

      await appendEvent(event);

      sendJson(res, 200, { ok: true, id: event.id });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

server.listen(PORT, "127.0.0.1");

console.log(`ACE message intake listening on http://127.0.0.1:${PORT}`);
