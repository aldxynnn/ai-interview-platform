# Fullstack Product Engineer Case Study — Portfolio Decision Reliability

> Evidence status: code and analysis are committed to the assessment branch. Build, automated tests, browser checks, screenshots, and the demo video have **not** been run/captured from this environment. Do not interpret planned checks as passing.

## Step 1 — Setup and local exploration

Repository: `rakamindev/ai-interview-platform` (working fork: `aldxynnn/ai-interview-platform`).

The brief describes a Rails 7 API backed by PostgreSQL and Sidekiq, plus a React 18 + TypeScript + Vite web application. The API has RSpec dependencies but the brief states there were no specs; the web package has a build script but no test runner. This branch adds a small RSpec baseline, model specs, and a controller spec for invalid export context; a frontend test runner is still not configured.

The selected slice is the assessor's portfolio results and export workflow. It is decision support, not a cosmetic page: a silent request failure can be mistaken for absent candidate evidence, while a failed or misleading export can interrupt review.

## Step 2 — Product and domain context

### Users and affected people

- **Assessors/recruiters/hiring managers:** need clear evidence, a reliable skill summary, and a dependable path from portfolio review to vacancy fit/gap analysis.
- **Candidates:** are evaluated by a system they do not choose. An absent result must not be silently presented as an empty assessment, and AI-derived levels must remain distinguishable from assessor overrides.
- **Data protection:** portfolio screens may expose candidate names, interview transcript excerpts, competency summaries, and inferred skill ratings. Under Indonesia's UU PDP context, avoid logging candidate content or raw model output unnecessarily, restrict access to authorized assessors, and make the source/uncertainty of AI-derived claims legible. This branch does not claim to have completed a legal compliance audit.

### Product principle

The highest-value near-term improvement is to make decision-critical failure states explicit and recoverable without implying that missing data means a candidate lacks a skill. AI-generated assessment should be treated as evidence-assisted judgement, not ground truth.

## Step 3 — Problem and gap analysis

Severity describes user/product impact for the observed code path, not a claim that every issue is confirmed in production.

| Priority | Finding | Classification | Workflow / candidate impact |
|---|---|---|---|
| P1 | Initial portfolio, vacancy, or session request failures were swallowed by an empty catch. | Defective implementation | An assessor could mistake a failed load for missing candidate evidence and make a decision from an incomplete screen. |
| P1 | Portfolio export errors had no user-facing recovery state. | Defective implementation | The user could click PDF/JSON and receive no useful explanation when the request failed. |
| P1 — investigation required | Portfolio and fit/gap controller lookups need an explicit tenant-boundary audit across session, portfolio, vacancy, and cached report. | Constraint/security signal; not asserted as a proven exploit | Cross-tenant exposure of candidate evidence would be high impact under UU PDP. The current branch does not claim this audit is complete. |
| P2 | The screen did not explicitly explain the case where there are no configured skills or no vacancies. | Defective UI state | An empty section can look broken; a missing vacancy list can make fit/gap unavailable without explaining why. |
| P2 | API export accepted a supplied vacancy ID that did not resolve and could silently proceed without that vacancy context. | Defective implementation | A user can receive an export that does not match the requested comparison context. |
| P2 | Long evidence quotes and long competency summaries need visual stress testing and truncation/expansion decisions. | Missing specification | Dense evidence can overwhelm review and make it harder to distinguish claims from supporting quotes. |
| P2 | Partial loading policy is not specified: current page fetch uses `Promise.all`, so one optional dependency can fail the whole page. | Missing specification / architectural constraint | A vacancy service outage can hide an otherwise available portfolio. |
| P3 | No web test runner exists in `web/package.json`; API RSpec dependencies exist but the brief says no specs were written. | Missing engineering harness | Regressions are difficult to prove automatically and CI cannot protect the flow yet. |

### Constraint signal to escalate

Before shipping to production, verify tenant isolation for every portfolio, vacancy, fit/gap, and export lookup; define which endpoints can access candidate data; and confirm the session's tenant matches the vacancy's tenant. Also agree whether vacancies are required to render the portfolio or should fail independently. These are higher-risk decisions than a visual polish pass.

## Step 4 — Revamp strategy, acceptance criteria, and trade-offs

### Options considered

**Option A — Patch the current page and export contract (selected for this slice).**
- Product impact: makes failure and empty states explicit, adds retry/recovery affordances, and rejects invalid export context.
- Cost: small and reversible; preserves existing API payloads and UI architecture.
- Maintainability: low migration burden; current team can maintain it in the existing controller/page.
- Failure modes: initial fetch still uses all-or-nothing `Promise.all`; backend model generation, timeout handling, tenant audit, and async-job idempotency are not comprehensively covered.

**Option B — Load independent panels with separate states.**
- Product impact: portfolio evidence can remain visible when vacancies fail; users can still inspect the candidate.
- Cost: medium; requires independent loading/error states and a clearer dependency policy.
- Maintainability: more state to manage, but better isolation of optional services.
- Failure modes: inconsistent refresh timing and stale panel data if invalidation rules are not defined.

**Option C — Rework portfolio/fit-gap API contracts and async generation lifecycle.**
- Product impact: strongest long-term reliability, with explicit statuses, idempotent job enqueueing, tenant-scoped queries, and typed partial results.
- Cost: high; touches API, workers, data model, migrations, frontend, and tests.
- Maintainability: best if designed consistently, but broadest change and highest deadline risk.
- Failure modes: migration/rollback hazards, job duplication, compatibility breakage, and retry storms if idempotency is not designed first.

**Decision:** ship Option A as a narrow, reversible reliability slice now; record Option B and C as follow-up architecture work. Do not present this slice as a complete production hardening.

### Self-defined acceptance criteria

1. While required initial data is loading, show skeletons; on failure, show a visible alert and a retry action.
2. Retry must run the same request path and return to a visible error state if the retry also fails.
3. Successful load must preserve the existing portfolio, discovered skills, transcript navigation, exports, and fit/gap action.
4. Export failure must produce a visible, non-sensitive error; the user can retry without reloading the page.
5. An empty configured-skill collection must say no configured skills were assessed; an empty vacancy collection must explain that a vacancy is needed for fit/gap.
6. A supplied unknown vacancy ID on export must return a not-found response rather than silently exporting without vacancy context.
7. AI levels remain constrained to the 1–5 scale; unsupported confidence values are rejected; absent evidence normalizes to an empty list rather than crashing presentation.
8. Model/provider failures must never be described as a successful assessment. The user should see a failed/pending state, not invented evidence. (The full model timeout/retry lifecycle is not implemented by this slice.)
9. Long text must remain readable on narrow screens and must not overflow the viewport. This needs manual visual verification before submission.
10. No real candidate data, credentials, or raw AI responses should be added to logs, screenshots, commits, or the report.
11. Tests must demonstrate invalid ratings/confidence are rejected and evidence normalization is stable. A seeded fault must be introduced on a scratch branch, observed to fail, then reverted with history retained before claiming that requirement is complete.

## Step 5 — Implementation and verification

### Implemented in this branch

- `web/src/pages/portfolio/PortfolioPage.tsx`: visible load-error alert with retry/back navigation; visible export-error feedback; empty states for no configured skills and no vacancies; fit/gap controls adapt to narrow widths.
- `api/app/controllers/api/v1/portfolios_controller.rb`: when an export explicitly requests a vacancy, an unknown vacancy now returns 404 instead of silently continuing without that context.
- `api/spec/spec_helper.rb` and `api/spec/rails_helper.rb`: initial RSpec configuration.
- `api/spec/models/portfolio_skill_spec.rb`: coverage for allowed rating, out-of-range ratings, unsupported confidence, and evidence normalization. `api/spec/controllers/api/v1/portfolios_controller_spec.rb`: verifies the unknown-vacancy export guard.

### AI verification moment

A generated code change must be treated as a proposal, not proof. During source review, the relevant page's empty `catch` was confirmed in the repository and was the reason for the load-error state. The API export change was then checked against the controller's actual format validation and the `Vacancy` model's tenant-scoping concern; however, the full tenant-boundary behavior still requires an integration test. The tests added here are not claimed to have passed because they have not been run in this environment.

### Evidence checklist — complete these before submission

- [ ] Run API specs: from `api/`, `bundle exec rspec`.
- [ ] Run web production build: from `web/`, `npm ci && npm run build`.
- [ ] If the Rails test database is not prepared, follow the API README environment/database setup first; do not hide setup failures.
- [ ] Manually verify successful portfolio, failed initial load, repeated retry failure, retry recovery, export success/failure, no configured skills, no vacancies, generation failure, long text, and mobile/desktop widths.
- [ ] Perform seeded fault test on a scratch branch: deliberately break a covered validation/behavior, run the relevant test and observe failure, then revert the fault while preserving visible history. Do not weaken assertions.
- [ ] Capture real screenshots of normal, loading, error, empty, and responsive states with synthetic/non-sensitive data.
- [ ] Record a 3–5 minute demo covering the user problem, normal workflow, failure/recovery, and trade-off.
- [ ] Audit tenant authorization and all model/provider timeout/partial-write/duplicate-job paths before claiming those risks are resolved.
- [ ] Link the pull request against the employer's upstream repository if repository permissions allow. The working fork PR is not itself proof that an upstream PR exists.

## Pull request and artifacts

- Working fork PR: https://github.com/aldxynnn/ai-interview-platform/pull/6
- Assessment branch: `assessment/portfolio-ux-hardening`
- Source repository named in the brief: https://github.com/rakamindev/ai-interview-platform

## Final status

This is a targeted reliability improvement across the frontend and API, with an initial API model-test harness. It is **not yet a complete response to every baseline requirement**: test/build results, seeded-fault evidence, browser screenshots, video, tenant-boundary integration tests, and full model/provider/worker failure-path hardening remain outstanding. Never claim those items as completed until there is real evidence.
