import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const RUNTIME_LOG = join(ROOT, "data", "runtime", "ace.event-log.runtime.json");
const OUT_DIR = join(ROOT, "data", "seals");
const OUT_PATH = join(OUT_DIR, "ace.event-log.replay.json");

function nowUtcIso() {
  return new Date().toISOString();
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function isAcePublicMessage(e) {
  return e && e.kind === "ace_public_message" && typeof e.id === "string";
}

async function main() {
  if (!existsSync(RUNTIME_LOG)) {
    console.error("Missing runtime log");
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const bytes = await readFile(RUNTIME_LOG);
  const hash = sha256Hex(bytes);

  const parsed = JSON.parse(bytes.toString("utf8"));
  const events = Array.isArray(parsed.events) ? parsed.events : [];

  const valid = events.filter(isAcePublicMessage);

  const summary = {
    kind: "ace_kernel_replay",
    version: "1.0.0",
    time_utc: nowUtcIso(),
    runtime_log_sha256: hash,
    counts: {
      total_events: events.length,
      valid_public_messages: valid.length
    },
    sample: valid.slice(0, 3).map(e => ({
      id: e.id,
      time_utc: e.time_utc,
      urls: e.urls
    }))
  };

  await writeFile(OUT_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log("ACE kernel replay complete");
  console.log(`Valid messages: ${valid.length}`);
}

main().catch((err) => {
  console.error("Replay failed:", err);
  process.exit(1);
});
