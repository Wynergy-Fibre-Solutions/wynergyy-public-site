/**
 * ACE Core Engine (UI-agnostic)
 * Deterministic, governed navigation over a bounded knowledge tree.
 *
 * Design goals:
 * - No UI assumptions.
 * - No network calls.
 * - Deterministic routing from input -> node.
 * - Auditable: every step returns an event record.
 *
 * Usage:
 *   import { createAceEngine } from "./ace-engine.js";
 *   import { ACE_TREE } from "./ace-tree.js";
 *   const engine = createAceEngine({ tree: ACE_TREE });
 *   const r1 = engine.start();                 // -> { state, view, event }
 *   const r2 = engine.choose("about");         // -> navigate by node key
 *   const r3 = engine.text("who are you");     // -> deterministic map -> node
 */

export function createAceEngine({ tree, mapper, startKey = "root" }) {
  assertTree(tree);

  const mapText =
    typeof mapper === "function"
      ? mapper
      : (text) => defaultMapper(text, tree, startKey);

  /** @type {AceState} */
  let state = {
    key: startKey,
    history: [],
    lastInput: null,
    startedAt: Date.now(),
  };

  function start() {
    state = {
      key: startKey,
      history: [],
      lastInput: null,
      startedAt: Date.now(),
    };
    return emit("start", { to: startKey });
  }

  function reset() {
    return start();
  }

  function getState() {
    return deepFreeze(clone(state));
  }

  function getView() {
    const node = tree[state.key] || tree[startKey];
    return nodeToView(node, state.key);
  }

  function choose(nextKey, meta = {}) {
    const from = state.key;
    const to = normaliseKey(nextKey, tree, startKey);
    const allowed = isAllowedTransition(from, to, tree);

    if (!allowed) {
      return emit("blocked", { from, to, reason: "transition_not_allowed", meta });
    }

    state.key = to;
    state.lastInput = { type: "choose", value: String(nextKey), meta, at: Date.now() };
    return emit("choose", { from, to, meta });
  }

  function text(input, meta = {}) {
    const from = state.key;
    const value = String(input ?? "").trim();
    const to = normaliseKey(mapText(value), tree, startKey);

    state.key = to;
    state.lastInput = { type: "text", value, meta, at: Date.now() };
    return emit("text", { from, to, meta, input: value });
  }

  function eventLog() {
    return deepFreeze(clone(state.history));
  }

  function emit(type, payload) {
    const view = getView();
    const event = {
      id: makeEventId(),
      type,
      at: Date.now(),
      from: payload?.from ?? null,
      to: payload?.to ?? state.key,
      payload: clone(payload ?? {}),
    };
    state.history.push(event);
    return { state: getState(), view, event };
  }

  return {
    start,
    reset,
    getState,
    getView,
    choose,
    text,
    eventLog,
  };
}

/**
 * Default deterministic mapper.
 * You can replace this with a stricter controlled mapper later.
 */
export function defaultMapper(text, tree, startKey = "root") {
  const t = String(text ?? "").toLowerCase();

  // Core intent buckets (deterministic)
  if (hasAny(t, ["nda", "non disclosure", "nondisclosure"])) return "nda";
  if (hasAny(t, ["govern", "compliance", "ofcom", "lawful", "audit", "gdpr", "policy"])) return "gov";
  if (hasAny(t, ["telecom", "fibre", "fiber", "fttp", "civils", "build"])) return "telecoms";
  if (hasAny(t, ["job", "jobs", "work", "engineer", "contractor", "subcontract", "apply"])) return "engage";
  if (hasAny(t, ["value", "worth", "invest", "investor", "buy", "acquire", "licence", "license"])) return "value";
  if (hasAny(t, ["who", "about", "what is", "what are you"])) return "about";

  // Greetings route to start/root
  if (hasAny(t, ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"])) return startKey;

  // Unknown routes to root (bounded behaviour)
  return startKey;
}

/* -------------------------- Tree / View helpers -------------------------- */

function nodeToView(node, key) {
  const text = String(node?.t ?? "");
  const options = Array.isArray(node?.o) ? node.o.map(([label, target]) => ({
    label: String(label),
    target: String(target),
  })) : [];
  return { key, text, options };
}

function isAllowedTransition(from, to, tree) {
  if (!tree[from]) return true; // if state corrupted, allow recovery
  const opts = Array.isArray(tree[from].o) ? tree[from].o : [];
  return opts.some(([, k]) => String(k) === String(to));
}

function normaliseKey(key, tree, startKey) {
  const k = String(key ?? "").trim();
  if (k && tree[k]) return k;
  return startKey;
}

/* ------------------------------- Validation ------------------------------ */

export function assertTree(tree) {
  if (!tree || typeof tree !== "object") {
    throw new Error("ACE tree must be an object of nodes.");
  }
  if (!tree.root) {
    throw new Error("ACE tree must contain a 'root' node.");
  }

  for (const [key, node] of Object.entries(tree)) {
    if (!node || typeof node !== "object") {
      throw new Error(`ACE tree node '${key}' must be an object.`);
    }
    if (typeof node.t !== "string") {
      throw new Error(`ACE tree node '${key}' must include string 't' text.`);
    }
    if (node.o != null && !Array.isArray(node.o)) {
      throw new Error(`ACE tree node '${key}' options 'o' must be an array or undefined.`);
    }
    if (Array.isArray(node.o)) {
      for (const entry of node.o) {
        if (!Array.isArray(entry) || entry.length !== 2) {
          throw new Error(`ACE tree node '${key}' option entries must be [label, target].`);
        }
        const [label, target] = entry;
        if (typeof label !== "string" || typeof target !== "string") {
          throw new Error(`ACE tree node '${key}' options must be [string, string].`);
        }
      }
    }
  }

  // Optional: ensure all targets exist (strict mode)
  for (const [key, node] of Object.entries(tree)) {
    for (const [, target] of node.o ?? []) {
      if (!tree[target]) {
        // Do not throw: allow future expansion without breaking runtime.
        // Keep as governed warning behaviour in UI layer.
      }
    }
  }
}

/* -------------------------------- Utilities ------------------------------ */

function hasAny(text, needles) {
  return needles.some((n) => text.includes(n));
}

function makeEventId() {
  // deterministic enough for local logs; not crypto
  return "evt_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function deepFreeze(obj) {
  if (obj && typeof obj === "object") {
    Object.freeze(obj);
    for (const k of Object.keys(obj)) {
      deepFreeze(obj[k]);
    }
  }
  return obj;
}

/**
 * @typedef {{ key: string, history: AceEvent[], lastInput: null | {type:"text"|"choose", value:string, meta:any, at:number}, startedAt:number }} AceState
 * @typedef {{ id:string, type:string, at:number, from:string|null, to:string|null, payload:any }} AceEvent
 */
