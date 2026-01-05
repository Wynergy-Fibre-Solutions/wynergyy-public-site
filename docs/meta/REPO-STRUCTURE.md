\# Repository Structure Overview



This repository is intentionally structured for external readability, auditability, and governance review.



It is not a software monorepo.  

It is a public-facing kernel with a web surface and formal documentation.



---



\## Root Directory



The root contains the public site and high-level artefacts.



Key files:

\- `index.html` – Public landing page.

\- `README.md` – High-level introduction.

\- `ARCHITECTURE-SCOPE.md` – Declares architectural intent and limits.

\- `CHANGELOG.md` – Human-readable change history.

\- `KERNEL.md` – Definition of the public kernel.

\- `RUNTIME-DATA-POLICY.md` – Explicit runtime data handling posture.



Static assets and site pages live alongside these files to ensure transparency.



---



\## /docs



The `docs` directory contains structured documentation intended for reviewers, partners, and regulators.



\### /docs/START-HERE.md

Single entry point for understanding the repository.

This is the recommended first document for new readers.



\### /docs/governance

Formal governance, inspection, and boundary documents.



Includes:

\- Evidence handover protocols

\- External review boundaries

\- Inspection walkthroughs

\- Limits of automation

\- Strategic roadmap material



These documents define \*what this system is\* and \*what it is not\*.



\### /docs/meta

Meta-documentation about the repository itself.



Includes:

\- Repository structure explanations

\- Reading guides

\- Context for non-technical audiences



---



\## Design Principles



\- Flat, readable structure.

\- No hidden logic.

\- No runtime artefacts committed.

\- Documentation is first-class.

\- All content assumes external visibility.



---



\## Intended Audience



\- External reviewers

\- Partners

\- Regulators

\- Technical and non-technical stakeholders



This repository is designed to be read, not reverse-engineered.



---



End of document.



