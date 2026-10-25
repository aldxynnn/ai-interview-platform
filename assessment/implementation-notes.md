# Fit/Gap Trustworthiness Revamp

## Baseline and branch integrity

The source of truth is official upstream main at commit b836d02f45c6300b238b98ad50e66ead706723b6. The feature branch take-home/product-impact-revamp was created from that exact SHA and initially compared identical to fork main. It does not start from an old AI implementation branch.

The feature branch is being updated through GitHub's Git Data API because this execution environment cannot resolve github.com from the local shell. No local repository or user working tree was reset, deleted, or overwritten.

## Problem selected

The highest-value slice is the assessor's fit/gap decision-support flow. Source inspection identified:
- Portfolio and override endpoints without an explicit tenant ownership query.
- A backend/frontend contract mismatch (expected_level versus required_level) and missing confidence/override fields.
- Asynchronous report generation without a persisted lifecycle; polling could submit another generation request while an earlier request was still pending.
- Reports that could become stale after vacancy changes or assessor overrides.
- Skill comparisons indexed by label, which can discard duplicate labels even when IDs differ.
- AI-generated skill evidence presented without a source check.
- Portfolio skill replacement that previously deleted all old rows before creating replacements, risking partial writes and losing stable IDs.
- Invalid invite/network errors presented as interview completion.
- No existing RSpec examples, frontend test runner, or CI workflow.

## Product principles

- Fit/gap is decision support, not an automated hire/reject decision.
- An unassessed skill is unknown, not a gap.
- An AI level without a direct candidate quote is not used in fit/gap scoring.
- Assessor overrides are visible and take precedence in comparison results.
- Report status is explicit; queued, generating, stale, or failed results are not rendered as completed results.
- Candidate-facing messages do not claim successful recording when an invitation could not be verified.
- Error logs and API error messages do not include raw provider response bodies or transcript text.
- Any legal/compliance conclusion requires policy and operational evidence beyond this repository.

## Implementation

### Backend and data integrity
- Added reversible report lifecycle columns: generation status, generic generation error, and a lease timestamp.
- Added a scheduler using the report's unique portfolio/vacancy pair to suppress redundant enqueues, recover expired leases, and preserve the last result payload during generation.
- Worker checks tenant equality and claims a queued report under a row lock. The lease timestamp is passed to the engine so an older provider call cannot overwrite a newer generation requested after a vacancy/override change.
- Portfolio and portfolio-skill endpoints query through the owning session tenant. Fit/gap endpoints also resolve the vacancy in the current tenant; worker and engine re-check input ownership.
- Comparison output uses one result per vacancy requirement, stable skill IDs first, and label fallback only where a stable ID is absent. The response includes required level, confidence, and override marker.
- A skill with no supported candidate quote is not assessed for fit/gap.
- Narrative generation avoids automated hire/reject recommendations and inference about protected traits. Provider failures produce a deterministic neutral summary; logs do not include raw candidate or provider content.
- Portfolio generator validates JSON shape, skill identities, level/confidence fields and required configured skills before writing. Quotes are kept only if the text is present in a candidate transcript turn. Matching rows are updated within a transaction to preserve existing IDs and human overrides.
- Vacancy edits and assessor overrides mark related reports stale and request refresh. Scheduling failures are surfaced in API feedback/logs without leaking provider data.

### Frontend and interaction
- The comparison table now uses the API contract, makes required/candidate levels visible, includes confidence and assessor override state, and handles no comparisons explicitly.
- The report page has separate pending, error, failed, and complete states, retry feedback, export failure feedback, readable narrative sections, responsive spacing, and explicit decision-support messaging.
- Portfolio skills without evidence are labelled Not assessed and do not expose an override action for a rating that lacks direct evidence.
- Invalid candidate invite and network failure are distinct from a completed interview session.
- Assessment cards use semantic navigation links with visible keyboard focus. Invitation creation and copy-link operations show success only after the operation succeeds.
- The API local setup guide and frontend API defaults were aligned to the actual web/ and port 3001 setup.

## Testing added

RSpec examples cover tenant isolation for portfolio/override endpoints, stable-ID matching despite duplicate labels, a different ID not being mistaken for the same skill, no-evidence not assessed, human override precedence, cross-tenant engine guard, duplicate scheduling suppression, stale regeneration payload retention, expired lease recovery, cross-tenant scheduling guard, and validation of model evidence quotes against candidate transcript text.

Vitest component examples cover the displayed requirement level, assessor override marker, not-assessed behaviour, and the empty state. CI runs Rails specs and frontend component tests/build using PostgreSQL/Redis and synthetic keys.

These are test definitions, not proof that the suites pass. Record actual GitHub Actions results before claiming passing checks.

## AI Verification Moment

During review of the first report-scheduler draft, a local flag was initially assigned inside the create_or_find_by! block and then used to decide whether to enqueue a job. This is unsafe around concurrent unique-index conflicts because Rails may execute the block before it resolves to an already-existing row. A concurrent request could therefore believe it had created the report and enqueue duplicate work.

The implementation was corrected to inspect previously_new_record? on the record returned by create_or_find_by!. An RSpec regression example models the existing-row branch and asserts that no job is enqueued. This was discovered during source-semantics review and encoded as a test; a live race has not been reproduced in a running environment.

## Seeded Fault Test

A seeded fault must be introduced on a separate scratch branch only after the implementation CI is available. The recommended fault is to break the required-level mapping in the fit/gap payload or bypass the tenant lookup in the portfolio endpoint; the corresponding test should fail. Restore the original implementation in a follow-up commit, preserving the failed run and recovery history. This experiment is not marked complete until the scratch branch and actual run results are captured.

## Acceptance checklist

- [ ] Tenant A cannot read, export, recompute, or override Tenant B portfolio data.
- [ ] API and frontend agree on required level, candidate level, confidence, result, and override fields.
- [ ] Different skill IDs do not collide on duplicate display labels.
- [ ] Skills without supported candidate quotes return not assessed.
- [ ] Duplicate generation requests do not enqueue again while a valid lease is active.
- [ ] Expired generation leases can be recovered.
- [ ] A former worker cannot overwrite a later generation.
- [ ] Regeneration preserves the previous result payload until replacement completes.
- [ ] Vacancy edits and overrides invalidate report freshness.
- [ ] Malformed AI output does not replace portfolio skill rows with partial data.
- [ ] Invalid invite and network failure are not presented as interview completion.
- [ ] RSpec, Vitest, TypeScript build, and CI have recorded actual results.
- [ ] Seeded-fault failing/passing evidence is preserved on a scratch branch.
- [ ] Desktop/mobile, keyboard focus, network error, empty, and long-text states have been inspected in an actual browser.

## UU Pelindungan Data Pribadi

Interview transcript, candidate identity, and assessment results require careful handling under Indonesia's UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. The implementation minimizes sensitive error output and positions AI-generated fit/gap narratives as decision support. Repository inspection alone cannot establish legal compliance: candidate notices, lawful processing basis, retention/deletion policy, vendor agreements, access procedures, and incident response need confirmation from the responsible product/data owner.

## Outstanding evidence

- Local installation, migration, spec execution, Vitest, TypeScript build, and clean-clone run are not verified in this environment.
- Browser inspection and desktop/mobile/error-state screenshots require a running local app and are not inferred from source inspection.
- No walkthrough video URL has been created.
- No pull request has been opened; approval is still required to open one.
- The uploaded brief says Wednesday 19 August at 13:00 WIB without an explicit year. That date in 2026 is past as of 26 October 2026; submission status needs confirmation with the recruiter/portal.
