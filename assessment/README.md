# Rakamin Product Engineer Case Study - Implementation Notes

**Focus slice:** trustworthy Fit/Gap candidate assessment reports  
**Branch:** `feat/trustworthy-fit-gap`  
**Fork PR:** https://github.com/aldxynnn/ai-interview-platform/pull/1  
**Latest green CI head:** `85600c6596fcac46180519b06dc77283e9622476`

The hiring-platform submission must still be one PDF, as requested by the case-study brief. This folder contains the written narrative and evidence checklist; application code changes live in `api/` and `web/`.

## Executive summary

The product helps assessors compare skills evidenced in an AI-assisted interview against a vacancy's required skills. The selected end-to-end slice makes Fit/Gap reports safer to access, more reliable to generate, and easier to interpret.

The change covers:
1. Tenant ownership for portfolio, report, export, and override actions.
2. API/frontend contract correctness for the required skill level.
3. Explicit report generation states and generation-version fencing for duplicate or stale jobs.
4. Deterministic skill comparison with bounded AI narrative as advisory context only.
5. Candidate-impact UX: visible uncertainty, confidence, human override, and human-review guidance.

## Verification status

GitHub Actions completed successfully for the latest cleaned feature-branch head:
- CI run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40028271367
- Frontend component tests: 1 test file, 4 tests passed; production build succeeded.
- API: database schema load succeeded; RSpec reported 14 examples, 0 failures.
- Seeded fault was executed and restored. The deliberately broken equality comparison failed with 14 examples / 2 failures: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40027502286. The restoration commit passed with 14 examples / 0 failures: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40027691951.

The application was not launched locally in this environment because repository cloning failed due to unavailable DNS/network access. CI passing proves the configured automated checks, not a live end-to-end browser session.

## Submission artifacts

- [x] Open feature-branch PR on the fork: https://github.com/aldxynnn/ai-interview-platform/pull/1
- [x] Backend RSpec and frontend component/build checks pass in CI.
- [x] Seeded-fault failure and restoration evidence are retained in commit/run history.
- [ ] Open the pull request against the original repository if permitted: https://github.com/rakamindev/ai-interview-platform/compare/main...aldxynnn:feat/trustworthy-fit-gap?expand=1
- [ ] Capture actual screenshots from a running application: completed report, unassessed vs gap, pending/generating, failed/retry, empty state, and narrow viewport.
- [ ] Record a 3-5 minute walkthrough and add a reviewer-accessible link.
- [ ] Export and inspect the final single PDF with the upstream PR, actual screenshots, test evidence, and video link; upload it to the hiring portal.

Do not submit claims or visual evidence that have not been produced. The provided case-study PDF states a deadline of Wednesday 19 August, 13:00 WIB, while an earlier working note referred to 28 October 2026, 23:00 WIB. Confirm the actual deadline in the hiring portal before submission.
