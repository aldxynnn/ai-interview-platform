# Step 5–6: Verification, Evidence, and Submission

## 1. What has been added

- API data access is scoped to the current tenant through the owning session and tenant-scoped vacancy.
- Fit/Gap generation includes a lifecycle status and monotonically increasing version.
- A coordinator creates/reuses a report and reserves work before calling Sidekiq.
- The worker claims a version, fences off stale workers, checks same-tenant ownership, marks failures safely, and does not log prompt or candidate content.
- Skill result arithmetic is deterministic; AI is only asked for bounded advisory prose. Invalid model output falls back to a neutral summary.
- Frontend types match the actual API payload; report UI includes confidence, override provenance, unassessed skills, state panels, retry/export feedback, and a responsive table.
- Frontend component tests and a Rails RSpec harness have been added.
- A GitHub Actions workflow now attempts frontend tests/build and backend RSpec with a test PostgreSQL service.

## 2. Runtime status: be precise

Direct cloning from this execution environment failed because DNS/network access to GitHub was unavailable. Edits were therefore committed through the connected GitHub service to `feat/trustworthy-fit-gap`, but the full application was not launched locally here. Adding a CI workflow is not the same as a green CI run.

**Do not describe tests/build as passed until you have a green result from GitHub Actions or from your own runtime.** If CI fails, fix the root cause in a new commit; do not weaken assertions.

## 3. Local verification commands

Prerequisites follow the repo READMEs: Ruby 3.3.2, Node.js 18+, PostgreSQL and Redis/Sidekiq for the full application. The UI tests alone do not require the backend services.

### Frontend

```bash
cd web
npm install
npm run test
npm run build
```

### API

Copy the local environment sample without committing it, set real local PostgreSQL/Redis values, and never paste secrets into logs or commits.

```bash
cd api
cp config/application.yml.sample config/application.yml
bundle install
RAILS_ENV=test bundle exec rails db:schema:load
RAILS_ENV=test bundle exec rspec
```

For the end-to-end flow, start PostgreSQL and Redis, start Sidekiq, and then start Rails and Vite using each service's README. Gemini calls should be mocked in automated tests; a real secret should never be placed in fixtures.

## 4. Seeded-fault test procedure

The brief requires proof that a test actually catches a regression and that the temporary mutation is reverted with visible history. The test code includes an assertion for equality → `match`, but the following runtime experiment still needs to be executed and captured:

1. Commit all intended changes and confirm `bundle exec rspec spec/services/fit_gap/engine_spec.rb` passes.
2. Create a scratch branch from the feature branch, e.g. `git switch -c scratch/seed-fit-gap-fault`.
3. In `api/app/services/fit_gap/engine.rb`, temporarily alter the comparison decision so that an equal level is classified as `gap` (for example, change the `delta.zero?` branch to an always-false condition).
4. Run `cd api && bundle exec rspec spec/services/fit_gap/engine_spec.rb`. Capture the failing output that identifies the equal-level regression.
5. Restore the exact correct implementation with `git restore api/app/services/fit_gap/engine.rb`, run the same test and capture the passing output.
6. Preserve the scratch branch/commit history as proof, but do not merge the intentionally broken change to the feature branch.

This procedure has **not yet been executed in this environment**. Include its real failing and restored output in the final PDF; a written procedure alone does not meet the brief's proof requirement.

## 5. AI verification moment

A generated component test assertion initially used an ambiguous single-element query for repeated text and an incorrect count expectation. On review, the fixture contains four comparison rows with one outcome each, while some visible labels intentionally appear twice in a row (e.g. required level and assessed level both L3; result and candidate cell can both say "Not assessed"). The assertion was corrected to check the repeated elements/count deliberately rather than hiding or weakening the desired behavior. The correction was made before claiming the test passed.

A separate contract review compared the backend serializer and frontend table directly: the API sends `expected_level`, while the previous TypeScript/table read `required_level`. That mismatch is now reflected in a regression test and a unified frontend type.

This is a concrete example of AI-generated code/test output being risky until checked against source contracts and fixture semantics. It is not a claim that the test runner has passed.

## 6. Screenshot evidence to capture from the real runtime

Use only synthetic/demo candidate data, never a real candidate's transcript or contact details. Capture screenshots with the browser window and URL/state visible only as appropriate, and do not expose tokens.

- Completed report on desktop: all summary counts, required/assessed levels, confidence, and override provenance.
- `not_assessed` row next to a genuine `gap` row to show they differ.
- Pending/generating state during active queue execution.
- Failed state and successful retry (simulate with a test stub or safe local configuration).
- Narrow/mobile viewport showing the summary cards and horizontally scrollable table.
- Empty report/no configured skill state.

The redesigned UI is implemented in source, but these screenshots have not been captured from a running instance in this environment. Add the screenshots to the final PDF before uploading.

## 7. Three-to-five-minute video walkthrough

Suggested script:
- 0:00–0:30 — product problem and why a Fit/Gap row can affect a candidate.
- 0:30–1:15 — show required vs assessed level, confidence, override, and `not_assessed`.
- 1:15–2:00 — demonstrate loading, failure and retry.
- 2:00–2:45 — explain tenant scoping, deterministic calculation, generation version, AI narrative fallback.
- 2:45–3:30 — run automated tests and show the CI result.
- 3:30–4:00 — explain the rejected options and known trade-off (DB/Redis enqueue gap).

Host on Loom, unlisted YouTube, or reviewer-accessible Drive. Paste the live link into the final report; do not put in a placeholder link.

## 8. Final upload gate (deadline: 28 October 2026, 23:00 WIB)

- [ ] Open Pull Request exists and is linked from report.
- [ ] PR diff reviewed, no generated lock/config secret files included.
- [ ] CI green; test/build commands copied from actual output, not guessed.
- [ ] Seeded-fault failing and restored evidence captured.
- [ ] Actual runtime screenshots embedded.
- [ ] Video URL accessible to the reviewer and included.
- [ ] Final PDF exported, opened, rendered, and checked for clipped text.
- [ ] Upload exactly one PDF to the hiring portal before the stated deadline.
