# Technical decisions and acceptance criteria

## Selected approach

Use explicit tenant-constrained lookups in controllers and repeat the portfolio/vacancy tenant invariant in the fit/gap engine and worker. For regeneration, keep the current report row and content, update lifecycle metadata, enqueue a versioned job, and let only the latest generation version write the new successful result. For portfolio regeneration, validate the entire response before replacement and replace skills within a database transaction while retaining compatible assessor overrides.

## Options considered

| Option | Product impact | Cost / maintainability | Failure mode / trade-off |
|---|---|---|---|
| A. Controller-only tenant filtering and simple retry buttons | Quick reduction in exposed routes and clearer errors | Low initial cost; rules can drift across endpoints | Background jobs or service callers could still compare cross-tenant records. |
| B. Central service-level policy and generation lifecycle only | Strong reusable invariants and safer async work | Moderate refactor; existing controller paths still need consistent handling | UI can still be confusing if it hides errors or drops the old result. |
| C. Layered full-stack slice (selected) | Protects request boundaries, background processing, persisted state, and assessor recovery | Moderate cost, limited to assessment/portfolio/fit-gap paths | Requires careful migration and tests; does not replace a broader tenant authorization audit. |

## Acceptance criteria

### Tenant security
- [ ] An assessor cannot list, read, update, delete, export, or create sessions from another tenant's assessment.
- [ ] An assessor cannot read or mutate a portfolio, portfolio skill/override, or vacancy belonging to another tenant.
- [ ] Fit/gap generation rejects a portfolio/vacancy tenant mismatch, including background execution.
- [ ] Cross-tenant and missing IDs return a non-disclosing not-found response.

### Portfolio generation integrity
- [ ] AI output must be a JSON object with both configured/discovered arrays.
- [ ] Skill labels, levels 1–5, confidence values, evidence types, and competency summaries are validated; invalid values are rejected rather than clamped.
- [ ] Generated skills must correspond to the session coverage map, with no duplicates or omitted skills.
- [ ] Any failed validation or insert rolls back replacement, leaving the previous skill set intact.
- [ ] Existing assessor overrides are preserved for matching skills; if a skill with an override disappears from generated output, regeneration fails safely instead of deleting the human decision.
- [ ] Provider error details and candidate content are not copied into logs or persisted error messages.

### Fit/gap lifecycle and correctness
- [ ] Existing report content remains available while a refresh is queued/running.
- [ ] Queue failure or exhausted retries marks lifecycle state failed without deleting the prior report.
- [ ] Duplicate or stale generation jobs cannot overwrite a newer generation.
- [ ] A missing candidate rating or missing expected level is represented as `not_assessed`, with no fabricated delta.
- [ ] Deterministic skill levels remain separate from AI-generated advisory narrative.
- [ ] Narrative says human review is required and never recommends automatic acceptance/rejection.

### UI recovery
- [ ] Loading, generating, failed, retry, and export-error states are visible and accessible.
- [ ] When refresh fails, the previous successful fit/gap report remains on screen.
- [ ] Retry initiates a new generation when a report is failed; it does not merely re-fetch the same failed payload.
- [ ] Error messages are actionable and do not expose raw backend exceptions.

## Migration and rollback

The fit/gap lifecycle migration adds status, error, version, and start-time columns with safe defaults for existing reports. Rollback is the migration's standard reverse operation. Before deploying to a shared database, apply the migration in staging and verify old report rows default to `complete`; do not run it against production without the normal release approval.

## Known trade-offs

- A report with a previous successful result can have `generation_status = generating`; consumers must treat status separately from content freshness.
- The generation version prevents stale writes but does not provide a distributed lock for every possible concurrent enqueue race. The unique index on portfolio/vacancy remains the final database guard.
- The selected scope protects the assessed paths; a separate audit should still review every tenant-scoped model and endpoint.
