import fs from "fs";
import crypto from "crypto";

const [, , command, service, port] = process.argv;
const RUNTIME_DIR = "data/runtime";
const EVENTS_FILE = `${RUNTIME_DIR}/${service}.runtime.json`;

fs.mkdirSync(RUNTIME_DIR, { recursive: true });

function emit(type, details = {}) {
  const event = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    details
  };

  const existing = fs.existsSync(EVENTS_FILE)
    ? JSON.parse(fs.readFileSync(EVENTS_FILE, "utf8"))
    : [];

  existing.push(event);
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(existing, null, 2));
}

if (command === "check") {
  try {
    const net = await import("net");
    const tester = net.createServer();

    tester.once("error", () => {
      emit("runtime.lock-denied", { port });
      process.exit(1);
    });

    tester.once("listening", () => {
      tester.close();
      emit("runtime.start", { port });
      process.exit(0);
    });

    tester.listen(port, "127.0.0.1");
  } catch {
    emit("runtime.crash", { stage: "sentinel-check" });
    process.exit(1);
  }
}
