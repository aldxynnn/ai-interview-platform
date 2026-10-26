# Fit/gap assessment hardening — execution notes

## Step 1 — Setup and exploration
- Repository: https://github.com/aldxynnn/ai-interview-platform
- Base: `main`; implementation branch: `fix/fitgap-level-contract`.
- Stack observed in repository documentation: Rails API (PostgreSQL, Sidekiq, RSpec) and React 18 + TypeScript + Vite.
- Scope selected: fit/gap report computation and presentation seam.

## Step 2 — Product and domain context
Assessors and hiring managers need a defensible comparison between a candidate's evidence-backed portfolio and a role's expected skill levels. Candidates are affected by incorrect inferences even when they do not directly use the product. Under Indonesia's UU PDP, keep candidate data exposure minimal and avoid logging personal evidence. Fit/gap output should support human review, not make an opaque hire/reject decision.

## Step 3 — Severity-ranked findings
- **P1 — Defective implementation:** portfolio AI levels are represented as strings such as `L3`, while assessor overrides are integers. Subtracting a string from a numeric vacancy level can raise a type error and prevent report generation.
- **P1 — Defective implementation:** API serializes `expected_level`, but the frontend reads `required_level`; the requirement column can be blank/undefined even when data exists.
- **P1 — Product trust risk:** the AI narrative prompt previously invited an overall hiring recommendation. The deterministic comparison should remain the source of truth and missing evidence must not be interpreted as lack of ability.
- **P2 — Defective implementation:** a malformed or empty model response can leave narratives blank; fallback summary should remain available.
- **P2 — UX gap:** the table omits a visible not-assessed count and empty requirement state, obscuring uncertainty.
- **P3 — Maintainability:** level normalization and API contract should be explicit and tested at the service boundary.

Constraint signal: the repository does not expose a runnable local environment through the connected GitHub interface; therefore this branch can be inspected and committed remotely, but local test execution and real browser screenshots require a runtime not provided by the GitHub API connector.

## Step 4 — Strategy, acceptance criteria and trade-offs
### Options considered
1. **Normalize at the API computation boundary (chosen):** one small deterministic normalization function handles AI labels and integer overrides before arithmetic. Lowest implementation cost; preserves the existing data model.
2. Normalize in the frontend only: fixes display but leaves backend arithmetic failure; rejected.
3. Migrate all stored AI levels to integers: broader data migration, backfill and rollback risk; defer until schema/data audit proves it is needed.

### Acceptance criteria
- AI levels `L1`..`L5` and integer overrides map to numeric levels 1..5.
- Missing/invalid candidate or requirement levels produce `not_assessed`, never a fabricated gap or arithmetic exception.
- API response uses `expected_level` as stored internally but maps to the frontend contract key `required_level` and preserves null values for unassessed requirements..
- Override provenance is returned for the UI.
- Invalid/empty AI narrative falls back to an evidence-count summary.
- No automated hire/reject recommendation is produced.
- UI handles zero requirements, missing candidate level, and mobile-width tables.
- No real candidate data or secrets are added.

## Step 5 — Implementation and proof status
- Backend computation now normalizes level types before comparison, flags override provenance, guards malformed model output, and constrains narrative prompts to evidence-based summaries.
- Frontend comparison table now includes explicit counts for match / above requirement / gap / not assessed, safe labels, empty-state copy, and a human-review disclaimer.
- **Test status:** RSpec coverage for level normalization, invalid levels, overrides, and not-assessed behavior has been added but not executed in this environment. The GitHub connector can commit source but does not provide a local Ruby/PostgreSQL/Redis/Node runtime. Do not treat the code as verified until CI/local tests pass.
- **Seeded fault test:** pending execution in a scratch branch; no pass/fail result is claimed.
- **AI verification moment:** an initial AI-generated comparison assumption would have subtracted `"L3"` from an integer. Inspection of the model/controller types revealed the risk; the implementation now normalizes values before arithmetic. This is a code-review finding, not a claim that automated tests caught it.
- **Screenshots/video:** pending browser runtime and recording. None are fabricated in this report.

## Step 6 — Submission checklist
- Draft PR: created against the fork's `main`; upstream contribution still requires a PR against `rakamindev/ai-interview-platform` if access/policy permits.
- Visual screenshots: pending.
- 3–5 minute walkthrough: outline: explain assessor workflow; show a generated report; demonstrate missing/invalid level and human override states; explain evidence limits and trade-offs.
- Release gate: run API specs and frontend TypeScript/build checks; perform a seeded-fault mutation on a scratch branch and restore it; inspect mobile/responsive and model-failure states; then open PR.
