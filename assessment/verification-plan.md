# Verification plan and evidence

## Automated checks

The new branch adds:
- RSpec unit coverage for portfolio output validation: valid payload, out-of-range level, missing arrays, and invalid evidence type.
- RSpec unit coverage for fit/gap tenant mismatch, unassessed skill behavior, and missing expected level.
- Vitest/React Testing Library coverage for portfolio retry recovery, fit/gap error recovery, retaining the previous report during refresh, and PDF-import client validation.
- RSpec unit coverage for PDF-import schema validation and current Gemini model/endpoint selection.
- GitHub Actions jobs for API specs, frontend component tests, and frontend type-check/production build.

Run locally:
```bash
cd api && bundle exec rspec
cd web && npm install && npm test && npm run build
```

## Seeded fault test — completed

The experiment ran on a separate branch, `take-home/seeded-fault-check`; the implementation branch was not deliberately broken.

- Baseline on the scratch branch passed: [CI run 40218374018](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40218374018).
- Deliberate fault commit: [ebb0e24](https://github.com/aldxynnn/ai-interview-platform/commit/ebb0e24d2364e14592586f717741bf0518ac980c) inverted the tenant guard.
- The test caught it: [CI run 40218377849](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40218377849) failed the two relevant assertions — the cross-tenant case no longer raised, and the same-tenant case raised unexpectedly. The RSpec job reported 8 examples, 2 failures.
- Revert-by-new-commit: [5462e25](https://github.com/aldxynnn/ai-interview-platform/commit/5462e254fcebfd5ba363a3d3b75bb42208d0f2dd) restored the guard without rewriting history.
- Restored branch passed: [CI run 40218482223](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40218482223).

The assertion was not weakened, and the fault/recovery history remains visible on the scratch branch.

## AI verification moment

An unsafe normalization pattern in the baseline used `to_i.clamp(1, 5)` for AI-provided levels. That hides invalid model output (for example, level 9 becomes 5) and makes a malformed response look valid. The implementation instead validates the original level as an integer in the allowed range and rejects the full payload before deleting/replacing stored skills. The regression test explicitly checks level 9 is rejected. This is a concrete example of treating AI output as untrusted data, not a source of truth.

## Verification results and boundaries

- The initial added Gemini client specs failed before the fix because constructing `Gemini::HttpClient` raised `Faraday::Error`: the app configured Faraday's retry middleware but never explicitly loaded `faraday/retry`. This failure was observed in [CI run 40222875850](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40222875850). The client now requires the middleware, uses the `v1beta` GenerateContent endpoint, and maps retired Gemini 2.0 text model IDs to `gemini-3.8-flash`.
- [CI run 40223130607](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40223130607) passed on code head `561b148`: API RSpec 15 examples / 0 failures; frontend tests 5 passed across 3 test files; TypeScript check and production build succeeded. This run includes a portfolio failure/retry regression test.
- PDF import now has a tenant-authenticated endpoint, in-memory text extraction, file-size/page/text limits, structured output validation, and a review step before starting fit/gap. The automated tests mock the upload UI and unit-test extraction-output validation; they do not yet prove a real PDF request through Rails or a live Gemini API call.
- The local container could not clone GitHub because DNS resolution for `github.com` failed; no local database-backed integration test or manual browser walkthrough is claimed.
- An initial attempt to boot the full Rails environment from the new test helper failed with `NameError: uninitialized constant AudioWebsocketMiddleware`. The current RSpec suite therefore exercises service logic without booting the full Rails app; integration boot and request-level tenant authorization remain verification gaps.
- No screenshots or video are included yet because the UI was not run in a browser in this environment. Capture genuine screenshots of loading, failed refresh with retained report, successful report, mobile/responsive layout, and export recovery when a local environment is available. Record a real 3–5 minute demo link before final submission.
- No PR has been created, and no merge or upstream change has been made.
