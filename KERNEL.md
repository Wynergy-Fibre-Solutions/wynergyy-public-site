\# ACE Kernel Declaration



Kernel name: ACE Public Intake Kernel  

Kernel version: 1.0.0  

Declared: 2026-01-04 (UTC)



\## What this kernel is



A minimal truth-bearing intake kernel that:

\- Accepts public messages via a stable API boundary.

\- Normalises and bounds-checks input deterministically.

\- Extracts URLs deterministically.

\- Emits schema-governed message envelopes.

\- Appends events to an append-only runtime log.



\## What this kernel is not



\- Not a chatbot.

\- Not an intelligence engine.

\- Not policy optimisation.

\- Not autonomous decisioning.

\- Not external integration orchestration.



\## Contracts



\- Message envelope schema: data/ace.message.schema.json

\- Message kind: ace\_public\_message

\- Runtime log: data/runtime/ace.event-log.runtime.json (generated, not committed)



\## Guarantees



\- Deterministic handling for a given input class.

\- Append-only event emission for accepted messages.

\- Explicit rejection for invalid input.

\- Replayable evidence via runtime log.

\- Sealing supported via SHA-256 snapshot hashes.



\## Sealing model



Sealing produces a tracked artefact that contains:

\- A SHA-256 hash of the runtime log at a point in time.

\- Timestamp and kernel version metadata.

\- Byte size and canonical path reference.



The runtime log is not committed. The seal is committed.



