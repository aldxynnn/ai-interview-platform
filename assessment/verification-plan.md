# Verification plan and evidence

## Automated checks

The new branch adds:
- RSpec unit coverage for portfolio output validation: valid payload, out-of-range level, missing arrays, and invalid evidence type.
- RSpec unit coverage for fit/gap tenant mismatch, unassessed skill behavior, and missing expected level.
- Vitest/React Testing Library coverage for fit/gap error recovery and retaining the prior report during a failed refresh.
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

- [CI run 40218620332](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40218620332) passed on branch head `c0edc6e`: API RSpec 8 examples / 0 failures; frontend component tests 2 passed; TypeScript check and production build succeeded.
- Earlier successful run [40218574512](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40218574512) also passed after restoring an unrelated, unverified Rails autoload-path line to its baseline.
- The local container could not clone GitHub because DNS resolution for `github.com` failed; no local database-backed integration test or manual browser walkthrough is claimed.
- An initial attempt to boot the full Rails environment from the new test helper failed with `NameError: uninitialized constant AudioWebsocketMiddleware`. The current RSpec suite therefore exercises service logic without booting the full Rails app; integration boot and request-level tenant authorization remain verification gaps.
- No screenshots or video are included yet because the UI was not run in a browser in this environment. Capture genuine screenshots of loading, failed refresh with retained report, successful report, mobile/responsive layout, and export recovery when a local environment is available. Record a real 3–5 minute demo link before final submission.
- No PR has been created, and no merge or upstream change has been made.
