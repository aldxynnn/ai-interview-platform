# Verification notes — Rakamin take-home

Date: 2026-10-26

## AI Verification Moment (real finding, corrected)

During a follow-up review of the implementation, `Api::V1::PortfoliosController#find_vacancy!` was found to use an unscoped `Vacancy.find_by(id: id)`, even though portfolio lookup was tenant-scoped. This meant a tenant-A assessor could submit a tenant-B vacancy ID to the Fit/Gap scheduling endpoint. The exact downstream exposure depends on the report lifecycle, but the missing tenant boundary was a concrete authorization defect.

Correction on `take-home/trustworthy-fitgap-20261026`: scope vacancy lookup by both ID and `current_tenant_id`.

Regression test added in `api/spec/requests/portfolio_tenant_access_spec.rb`: a tenant-A portfolio must not schedule a Fit/Gap report against tenant-B's vacancy, and the request must not create a report.

This is an actual defect found in the AI-assisted implementation and verified by reading the controller flow; it is not a hypothetical example. The test was added after the previously recorded successful CI run, so its passing status must not be inferred from that older run.

## Seeded fault experiment

Scratch branch: `scratch/seeded-fault-fitgap-20261026`

- Seeded fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/91f2405bd96395bc508bb99e7ea6541e0b0d3305 — intentionally changed the tenant-scoped vacancy lookup back to an unscoped lookup.
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/74317ce7cd093da7825b2cb9d43f8917e26e1377 — restored the tenant-scoped lookup.
- The scratch branch is separate from the implementation branch; the deliberate fault was not applied to the implementation branch.
- **Verification status: pending evidence.** The available GitHub connector could confirm both commits and their diffs, but could not retrieve the Actions run/check result for the fault commit. Therefore this document does not claim that CI was observed failing on the seeded fault or passing after recovery.

## CI evidence boundary

The earlier recorded successful CI run is https://github.com/aldxynnn/ai-interview-platform/actions/runs/40256979092 and corresponds to commit `1d285f951ce12857a8f9b86a07381d78cacc8f5b`. It reported 16 RSpec examples with 0 failures, frontend Vitest passing, production build passing, and migration rollback/re-apply passing. These results predate the additional cross-tenant-vacancy regression test and must not be represented as validation of the latest branch head.

Browser E2E/responsive review, live Gemini integration, and a full local setup run remain unverified in this environment.
