# Verification notes — Rakamin take-home

Date: 2026-10-26

## AI Verification Moment (real finding, corrected)

During a follow-up review of the implementation, `Api::V1::PortfoliosController#find_vacancy!` was found to use an unscoped `Vacancy.find_by(id: id)`, even though portfolio lookup was tenant-scoped. This meant a tenant-A assessor could submit a tenant-B vacancy ID to the Fit/Gap scheduling endpoint. The exact downstream exposure depends on the report lifecycle, but the missing tenant boundary was a concrete authorization defect.

Correction on `take-home/trustworthy-fitgap-20261026`: scope vacancy lookup by both ID and `current_tenant_id`.

Regression test added in `api/spec/requests/portfolio_tenant_access_spec.rb`: a tenant-A portfolio must not schedule a Fit/Gap report against tenant-B's vacancy, and the request must not create a report.

This is an actual defect found in the AI-assisted implementation and verified by reading the controller flow; it is not a hypothetical example. The test was added after the previously recorded successful CI run, so its passing status must not be inferred from that older run.

## Seeded fault experiment

Initial scratch attempt (`scratch/seeded-fault-fitgap-20261026`) was not an isolated experiment: both the deliberate-fault and recovery CI runs failed because the new test hit `AbstractController::DoubleRenderError` in the error helper. This did not prove the intended tenant-scope regression.

A clean isolated attempt was then started from the implementation commit after fixing the error helper: `scratch/seeded-fault-isolated-20261026`.

- Seeded fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/91f2405bd96395bc508bb99e7ea6541e0b0d3305 — intentionally changed the tenant-scoped vacancy lookup back to an unscoped lookup.
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/74317ce7cd093da7825b2cb9d43f8917e26e1377 — restored the tenant-scoped lookup.
- The scratch branch is separate from the implementation branch; the deliberate fault was not applied to the implementation branch.
- Isolated fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/c5268e6f2a5384624db07bf4bbc822307174c06c (removes only `tenant_id` from vacancy lookup, preserving error handling).
- Isolated recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/0398928da567264baed414bda2f3723feab8a48f (restores tenant scope).
- **Verification status: pending Actions completion** for the isolated fault and recovery commits. Do not claim the intended failure/pass until the run logs are checked.

## CI evidence boundary

The latest verified successful implementation CI run is https://github.com/aldxynnn/ai-interview-platform/actions/runs/40260693346 at commit `fefb4ac2d65ade6e2d07821316c4da3a32179d61`: API RSpec passed, Web Vitest and production build passed, and the API job's migration rollback/re-apply step passed. This run includes the cross-tenant-vacancy regression spec and the fix for `DoubleRenderError`. An older successful run is https://github.com/aldxynnn/ai-interview-platform/actions/runs/40256979092 (16 RSpec examples, 0 failures), but the newer run is the relevant current evidence.

Browser E2E/responsive review, live Gemini integration, and a full local setup run remain unverified in this environment.
