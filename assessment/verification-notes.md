# Verification notes — Rakamin take-home

Tanggal verifikasi: 27 Oktober 2026.

## Final branch CI

- Branch: `feat/fit-gap-trustworthy-revamp`
- Commit CI: `632aacdf59ef82d0fe7eeb091bf7558d46bc7459`
- Run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40449318172
- Result: completed / success.
- API job: RSpec and migration rollback/re-apply passed.
- Web job: Vitest/component tests and production build passed.

CI only verifies the automated checks configured in the workflow. It does not establish that a human ran the application in a browser, that responsive behavior is polished, that a clean local clone works, or that the live Gemini provider is reachable.

## AI Verification Moment (real defect, corrected)

CI initially caught an error-handling defect in `Api::V1::PortfoliosController#find_vacancy!`: when a vacancy lookup failed, the helper rendered an error but returned a truthy render result. The calling action then continued and could render again, causing `AbstractController::DoubleRenderError`. The helper was changed to render the error and explicitly return `nil`. Request specs and CI after the fix passed.

A separate review concern was the query's missing explicit `tenant_id`. The `Vacancy` model includes `TenantScoped`, whose default scope also filters by `Current.tenant_id`; therefore `Vacancy.find_by(id: id)` alone was not proof of an actual tenant-scope bypass. The implementation includes an explicit tenant condition as defense-in-depth. The valid seeded fault used `Vacancy.unscoped.find_by(id: id)` to deliberately bypass that default scope.

## Seeded fault experiment

Valid isolated experiment branch: `scratch/seeded-fault-unscoped-20261026`.

- Fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316 — changed the lookup to `Vacancy.unscoped.find_by(id: id)`.
- Fault CI: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272 — failed as expected: the cross-tenant scheduling test expected 404 but received 503; 19 examples, 1 failure. The regression test detected the deliberate bypass.
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d — restored tenant-scoped lookup.
- Recovery CI: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460 — passed.
- The fault was only on the scratch branch, not the implementation branch. Earlier scratch attempts were not isolated correctly and are not used as evidence.

## Privacy verification

Portfolio generation and exhausted Sidekiq retries persist generic failure messages and log only the exception class, because provider error text may contain response bodies or transcript fragments. A regression spec asserts the stored error and log do not include provider message details.

## Remaining manual verification / submission items

Not completed in this environment:
- Browser smoke test, responsive review, keyboard/focus, console/network, and actual screenshots.
- Local setup from a clean clone.
- Gemini failure/timeout path with a stub and live provider integration if credentials are available.
- Upstream PR to `rakamindev/ai-interview-platform`. The integration attempt returned HTTP 403 (Resource not accessible by integration); draft PR #8 is only in the user's fork: https://github.com/aldxynnn/ai-interview-platform/pull/8.
- 3–5 minute video walkthrough and final exported PDF.

These are explicitly left as submitter tasks and must not be represented as completed until performed.
