# Fit/Gap Trustworthiness Revamp

## Why this slice

The source audit at upstream commit b836d02f45c6300b238b98ad50e66ead706723b6 found a mismatch between backend fit/gap payloads and frontend fields, portfolio-based endpoints without an explicit tenant boundary, report polling that could trigger repeated generation requests, stale reports after role requirements or assessor ratings change, and candidate invite errors shown as interview completion.

This slice focuses on the report assessors use to compare candidate evidence with role requirements. It does not rewrite the whole application.

## Product principles

- Fit/gap is decision support, not an automated hire/reject decision.
- An unassessed skill is unknown, not a gap.
- An AI level without a direct candidate quote is not used in fit/gap calculation.
- Assessor overrides are visible and take precedence in comparison results.
- Report status is explicit; a queued, generating, stale, or failed report is never rendered as a completed result.
- Candidate-facing messages must not claim successful recording when an invitation could not be verified.
- Error logs and API error messages must not contain raw provider response bodies or transcript text.

## Implementation summary

- Added lifecycle fields to fit/gap reports and an idempotent scheduler around the unique portfolio/vacancy pair.
- Restricted portfolio and portfolio-skill lookups through the owning session tenant, and validate tenant equality again before report generation.
- Added a lease timestamp to recover jobs that stop while queued/generating.
- Compare by stable skill ID when present; use case-insensitive label matching only for custom skills without a stable ID.
- Return the field names the UI consumes, including required level, confidence, and override marker.
- Preserve the last comparison payload while regeneration is queued; the UI only renders a report as current when the API status is complete.
- Mark reports stale on vacancy changes and assessor overrides, then enqueue refresh.
- Validate AI portfolio responses and update skill rows transactionally, matching existing skills to retain their IDs and assessor overrides.
- Mark skills with no direct evidence as not assessed in portfolio and fit/gap views.
- Replace misleading candidate-invite failure state with separate validation, network error, and completed-session states.
- Added backend RSpec and frontend Vitest coverage and a CI workflow.

## Verification status

Source edits and test cases are committed separately from verification. A test is considered passed only when its command or CI job has actually completed successfully. Until CI results are captured, report execution status as **pending verification**. Browser visual QA, live audio interaction, and responsive screenshots require a running local environment and are not inferred from source inspection.

## Acceptance checklist

- [ ] Tenant A cannot read/export/recompute or override Tenant B portfolio data.
- [ ] API and frontend agree on required level, assessed level, confidence, result, and override fields.
- [ ] Different skill IDs do not collide on duplicate display labels.
- [ ] Skills without candidate evidence return not assessed.
- [ ] Duplicate generation requests enqueue no duplicate work while a recent lease is active.
- [ ] Expired generation leases can be recovered.
- [ ] A regeneration preserves the last report payload until a replacement is complete.
- [ ] Vacancy edits and assessor overrides invalidate report freshness.
- [ ] Malformed AI output does not replace portfolio skill rows with partial data.
- [ ] Invalid invitation and network failure are not presented as interview completion.
- [ ] RSpec, Vitest, TypeScript build, and CI have recorded actual results.
- [ ] Seeded-fault experiment is performed on a scratch branch and its failing/passing evidence retained.
- [ ] AI Verification Moment is documented from an actual mistake observed and corrected during implementation.
- [ ] Desktop, mobile, keyboard, focus, network-error, and long-text UI states are inspected in a real browser.

## Known constraints

- The connected environment can update GitHub objects and branches but cannot resolve github.com from the local shell. Local runtime/browser execution has not been performed in this session.
- The original product wiki should be reviewed when it becomes accessible; the uploaded case-study brief remains the authoritative assignment source.
