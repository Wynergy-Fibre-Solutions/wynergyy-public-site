\# Runtime Data Policy



Certain ACE artefacts are generated during execution or analysis

and are intentionally excluded from version control.



Excluded artefacts include:

\- ace.dry-run.json

\- ace.event-log.json

\- ace.observability.json

\- ace.readiness.json



These files represent transient state, not source-of-truth.



\## Promotion Criteria



A runtime artefact may be promoted to source only if:

\- It is deterministic

\- It is non-sensitive

\- It is required for public understanding

\- Its inclusion is explicitly documented



Until then, runtime data remains excluded by policy.



Last reviewed: 2026-01-04 (UTC)



