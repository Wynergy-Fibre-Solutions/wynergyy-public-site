#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import process from "process";

const [, , action, service, portArg] = process.argv;
const port = Number(portArg);

if (!action || !service || !port) {
  console.error("usage: runtime-sentinel.js check <service> <port>");
  process.exit(2);
}

const RUNTIME_DIR = path.resolve("data/runtime");
const LOCK_PATH = path.join(RUNTIME_DIR, `${service}.lock.json`);

if (!fs.existsSync(RUNTIME_DIR)) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (action === "check") {
  if (fs.existsSync(LOCK_PATH)) {
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    if (lock.pid && pidAlive(lock.pid)) {
      console.error(
        `runtime-sentinel: ${service} already running (pid ${lock.pid}, port ${lock.port})`
      );
      process.exit(1);
    }
  }

  const lock = {
    service,
    pid: process.pid,
    port,
    host: os.hostname(),
    started_utc: new Date().toISOString()
  };

  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2));
  process.exit(0);
}
