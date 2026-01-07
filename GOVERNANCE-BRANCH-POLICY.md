\# Branch Governance Policy



\## Purpose



This repository operates under protected branch rules to ensure:

\- Deterministic history

\- Auditable change control

\- Clear attribution of intent



\## Protected Branches



The `MAIN` branch is protected and enforces:

\- Changes via pull request only

\- Mandatory review

\- Squash-merge strategy



Direct pushes to `MAIN` are not permitted.



\## Working Practice



All work must:

\- Originate from a non-protected branch

\- Represent a single, well-defined intent

\- Be merged via pull request only



Local history may diverge during development and must be reconciled

against the canonical remote state where required.



\## Rationale



These controls are intentional.



They reduce ambiguity, prevent silent mutation of history, and ensure

that all changes remain inspectable and attributable.



