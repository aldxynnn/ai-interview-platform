# Verification notes — Rakamin take-home

Date: 2026-10-26

## AI Verification Moment (real defect, corrected)

CI initially caught an error-handling defect in `Api::V1::PortfoliosController#find_vacancy!`: when a vacancy lookup failed, the helper rendered an error but returned a truthy render result. The calling action then continued and could render again, causing `AbstractController::DoubleRenderError`. The helper was changed to render the error and explicitly return `nil`. A same-tenant GET positive control and same-tenant POST scheduling test were added. The implementation CI subsequently passed with 19 RSpec examples and 0 failures.

A separate review concern was the query's missing explicit `tenant_id`. The `Vacancy` model includes `TenantScoped`, whose default scope also filters by `Current.tenant_id`; therefore the earlier `Vacancy.find_by(id: id)` line alone was not proof of an actual tenant-scope bypass. The implementation now includes the explicit tenant condition as defense-in-depth. To make the seeded fault meaningful, the experiment uses `Vacancy.unscoped.find_by(id: id)` to deliberately bypass the default scope.

## Seeded fault experiment

Valid isolated experiment branch: `scratch/seeded-fault-unscoped-20261026`, based on the implementation with positive-control tests.

- Fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316 — changed the lookup to `Vacancy.unscoped.find_by(id: id)`, deliberately bypassing the tenant default scope.
- Fault Actions run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272 — **failed as expected**. The cross-tenant scheduling test expected 404 but received 503; RSpec reported 19 examples, 1 failure.
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8f3e024ec8a8c78a5818d — restored `Vacancy.find_by(id: id, tenant_id: current_tenant_id)`.
- Recovery Actions run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460 — **passed**.
- The fault was only in the scratch branch, never in the implementation branch.

Earlier scratch attempts were not isolated correctly and are not used as evidence.

## CI evidence boundary

Latest verified implementation CI run with same-tenant positive-control and scheduling tests: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261210781 at commit `5a0b0dd488013d52f7623860a83b703db931bda5`. Result: 19 RSpec examples, 0 failures; Web Vitest and production build passed; migration rollback/re-apply passed. The latest implementation-branch HEAD CI run is green: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261724286 (API RSpec and Web Vitest/production build jobs both succeeded).

Browser E2E/responsive review, actual UI screenshots, live Gemini integration, and full clean local setup remain unverified in this environment. Creating an upstream PR via the GitHub integration was attempted but rejected with HTTP 403 (Resource not accessible by integration); no PR has been created. The final branch `take-home/fitgap-reliability-final` is a clean one-commit snapshot directly on top of the verified upstream base. Creating an upstream PR through the GitHub integration was attempted again and rejected with HTTP 403 (Resource not accessible by integration); no PR has been created. Use GitHub's compare page to open it manually if needed.
