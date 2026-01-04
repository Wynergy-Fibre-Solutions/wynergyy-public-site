import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const RUNTIME_LOG = join(ROOT, "data", "runtime", "ace.event-log.runtime.json");
const SEAL_DIR = join(ROOT, "data", "seals");
const SEAL_PATH = join(SEAL_DIR, "ace.event-log.seal.json");

const KERNEL_VERSION = "1.0.0";

function nowUtcIso() {
  return new Date().toISOString();
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  if (!existsSync(RUNTIME_LOG)) {
    console.error(`Missing runtime log: ${RUNTIME_LOG}`);
    process.exit(2);
  }

  await mkdir(SEAL_DIR, { recursive: true });

  const bytes = await readFile(RUNTIME_LOG);
  const hash = sha256Hex(bytes);

  const seal = {
    kind: "ace_kernel_seal",
    version: "1.0.0",
    kernel_version: KERNEL_VERSION,
    time_utc: nowUtcIso(),
    algorithm: "sha256",
    runtime_log_path: "data/runtime/ace.event-log.runtime.json",
    runtime_log_bytes: bytes.length,
    runtime_log_sha256: hash
  };

  await writeFile(SEAL_PATH, JSON.stringify(seal, null, 2) + "\n", "utf8");

  console.log("ACE kernel sealed");
  console.log(`SHA-256: ${hash}`);
}

main().catch((err) => {
  console.error("Seal failed:", err);
  process.exit(1);
});
