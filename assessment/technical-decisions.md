# Step 4: Revamp Strategy, Options, and Trade-offs

## Chosen slice

Make the Fit/Gap report trustworthy as a decision-support tool by fixing the API-to-UI contract, scoping resources to the current tenant, adding a report-generation lifecycle, making skill comparison deterministic, handling AI narrative failures, and giving the assessor a clear UI for uncertainty and retry.

The scope is narrow enough to review as one end-to-end vertical slice. It touches the data lifecycle, worker, API serializer, TypeScript contract, and report UI instead of spreading effort across unrelated pages.

## Options considered

| Option | Product impact | Cost and maintenance | Failure modes / what it forecloses | Decision |
|---|---|---|---|---|
| A. Frontend-only polish | Fast visual gain, but does not fix resource ownership, incorrect required level, duplicate jobs, or AI failures | Lowest initial cost; leaves backend behaviour fragmented | Misleading data remains; cross-tenant exposure persists; network errors still ambiguous | Reject as insufficient |
| B. Generate the full report synchronously inside the request | One request path can be easier to understand and immediately returns the result | Fewer worker states initially, but request timeouts and model coupling make it hard to maintain | Slow Gemini response ties up HTTP; model outage blocks the whole page; client retries repeat work | Reject for the existing Rails + Sidekiq architecture |
| C. Deterministic skill calculation + versioned background lifecycle + advisory AI narrative (selected) | Correct levels, visible uncertainty, safe access, explicit failure/retry and better review experience | Moderate cost; requires lifecycle columns, migration, coordinator, worker tests, and UI states. Fits existing Sidekiq architecture | Needs a recovery/monitoring policy if enqueue succeeds/fails across database/Redis. Model narrative can still be wrong, so human review remains explicit | Choose |

## Why Option C fits this codebase

- Skill results are a deterministic comparison of two levels. A model does not need to decide arithmetic or whether a value is missing.
- The application already uses Sidekiq for portfolio generation and Fit/Gap generation, so an explicit report lifecycle fits rather than introducing a new queue technology.
- A monotonically increasing generation version lets an older worker detect that newer assessor input has superseded it before it persists.
- The same-tenant invariant is checked at the authenticated request boundary and again in the calculation path.
- The UI has to distinguish status, missing evidence, confidence, and override provenance because those meanings affect a human hiring decision.

## Architecture of the change

1. **Request:** controller resolves tenant-scoped portfolio/vacancy; portfolio must be complete.
2. **Reservation:** `FitGap::GenerationCoordinator` reuses a current report or atomically creates/reserves a new version before enqueue.
3. **Worker claim:** worker asks the report to claim the version; duplicates or stale versions are no-ops.
4. **Calculation:** engine verifies both records share a tenant, applies assessor override, and derives match/gap/exceed/not_assessed and delta.
5. **Narrative:** Gemini receives bounded role context and computed outcomes, not candidate name, invite token, raw transcript, or raw evidence. Response shape is validated; failure produces neutral fallback text.
6. **Persistence:** the engine persists only if the job still owns the generation version.
7. **Presentation:** client reads status; report has loading/error/retry/empty states and responsive summary/table. Model prose is secondary to deterministic results.

## Trade-offs and limits

- A `generation_version` protects against stale completion, but does not create exactly-once delivery between PostgreSQL and Redis. If a process dies after commit but before enqueue, a report might remain pending. A production follow-up should use a transactional outbox or scheduled reconciliation and metrics for stuck reports.
- A stale lease is recovered after 15 minutes. That value is a defensive default, not a measured SLA; compare it with real job duration and make it configurable once telemetry exists.
- The current human review callout is an interaction guardrail, not a full fairness audit, decision appeal workflow, or legal-compliance certification.
- Tenant-safe 404s are preferable to revealing that another tenant's resource exists.
- Model prompt input is bounded to reduce payload size, but long descriptions are still truncated rather than surfaced as a separate warning. Product owners should decide whether to show a "context truncated" disclosure.

## Rollback

The migration uses a reversible `change` and gives historical rows a default `complete` status so existing reports remain readable. Rollback code by reverting the feature branch; only roll back the migration after the application code no longer uses its columns and the effect on in-flight jobs has been assessed. Never roll back by weakening tests or manually editing a production schema.
