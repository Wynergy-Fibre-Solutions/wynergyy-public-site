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
      events: []
    };
    reset.events.push(event);
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
  send(res, status, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(obj, null, 2));
}

function sendHtml(res, status, html) {
  send(res, status, { "Content-Type": "text/html; charset=utf-8" }, html);
}

async function readStatic(filePath) {
  return readFile(join(ROOT, filePath), "utf8");
}

function isAllowedMethod(req, allowed) {
  return allowed.includes((req.method || "").toUpperCase());
}

function collectBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function normaliseMessage(input) {
  const text = typeof input === "string" ? input : "";
  const trimmed = text.trim();
  if (trimmed.length < 1) return { ok: false, reason: "empty" };
  if (trimmed.length > 2000) return { ok: false, reason: "too_long" };
  return { ok: true, value: trimmed };
}

function extractUrls(text) {
  const urls = [];
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(re) || [];
  for (const m of matches) {
    try {
      const u = new URL(m);
      urls.push(u.toString());
    } catch {
      // ignore
    }
  }
  return Array.from(new Set(urls)).slice(0, 10);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;

    if (path === "/" && isAllowedMethod(req, ["GET"])) {
      const html = await readStatic("index.html").catch(() => "");
      if (!html) {
        sendHtml(res, 200, "<!doctype html><html><body><h1>wynergyy-public-site</h1></body></html>");
        return;
      }
      sendHtml(res, 200, html);
      return;
    }

    if (path === "/status" && isAllowedMethod(req, ["GET"])) {
      const html = await readStatic("status.html");
      sendHtml(res, 200, html);
      return;
    }

    if (path === "/principles" && isAllowedMethod(req, ["GET"])) {
      const html = await readStatic("principles.html");
      sendHtml(res, 200, html);
      return;
    }

    if (path === "/api/health" && isAllowedMethod(req, ["GET"])) {
      sendJson(res, 200, { ok: true, service: "wynergyy-public-site", time_utc: nowUtcIso() });
      return;
    }

    if (path === "/api/message" && isAllowedMethod(req, ["POST"])) {
      const raw = await collectBody(req);
      const parsed = safeJsonParse(raw);
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, error: "invalid_json" });
        return;
      }

      const msg = normaliseMessage(parsed.value?.message);
      if (!msg.ok) {
        sendJson(res, 400, { ok: false, error: "invalid_message", reason: msg.reason });
        return;
      }

      const id = randomUUID();
      const urls = extractUrls(msg.value);

      const event = {
        id,
        kind: "public_message_received",
        time_utc: nowUtcIso(),
        source: "public_site",
        message: msg.value,
        urls
      };

      await appendEvent(event);

      sendJson(res, 200, {
        ok: true,
        id,
        received_utc: event.time_utc,
        urls_detected: urls.length
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: "server_error" });
  }
});

server.listen(PORT, () => {
  // intentional: no console noise required for evidential repo
});
