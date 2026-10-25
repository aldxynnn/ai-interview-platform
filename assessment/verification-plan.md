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

## Seeded fault test

Required by the case brief: create a separate scratch branch from the implementation branch, deliberately break one tested invariant (the cross-tenant guard), verify the matching RSpec test fails in CI, then restore the implementation in a new commit on the scratch branch. Do not weaken the assertion. Record both commit links and the failing/passing CI run links here after the experiment. This is not complete until those artifacts are recorded.

## AI verification moment

An unsafe normalization pattern in the baseline used `to_i.clamp(1, 5)` for AI-provided levels. That hides invalid model output (for example, level 9 becomes 5) and makes a malformed response look valid. The implementation instead validates the original level as an integer in the allowed range and rejects the full payload before deleting/replacing stored skills. The regression test explicitly checks level 9 is rejected. This is a concrete example of treating AI output as untrusted data, not a source of truth.

## Verification boundaries

- The local container could not clone GitHub because DNS resolution for `github.com` failed; no local database-backed integration test or manual browser walkthrough is claimed.
- GitHub Actions results must be checked on the final branch head before submission. Earlier runs failed while the test harness was being wired up; do not present those as passing evidence.
- No screenshots or video are included yet because the UI was not run in a browser in this environment. Capture genuine screenshots of loading, failed refresh with retained report, successful report, mobile/responsive layout, and export recovery when a local environment is available. Record a real 3–5 minute demo link before final submission.
- No PR has been created, and no merge or upstream change has been made.
