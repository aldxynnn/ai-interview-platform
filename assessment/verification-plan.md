# Step 5-6: Verification, Evidence, and Submission

## 1. What changed

- API data access is scoped to the current tenant through the owning session and tenant-scoped vacancy.
- Fit/Gap generation uses an explicit lifecycle status and monotonically increasing version.
- A coordinator reserves or reuses report generation before enqueueing Sidekiq work.
- The worker claims a version, fences off stale jobs, checks same-tenant ownership, marks failures safely, and avoids logging prompt or candidate content.
- Skill comparison is deterministic; AI provides bounded advisory narrative only. Invalid model output or model failure falls back to neutral text.
- Frontend types match the API payload. The report UI presents confidence, override provenance, unassessed skills, state panels, retry/export feedback, and responsive layout.
- RSpec and Vitest tests plus GitHub Actions were added.

## 2. Verified CI status and local runtime limit

Repository cloning from this execution environment failed because DNS/network access to GitHub was unavailable, so the complete application was not launched locally here. The latest feature-branch CI head was verified through GitHub Actions:

- Latest green CI run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40028271367
- Frontend component tests: 1 test file, 4 tests passed. Production build succeeded.
- API: PostgreSQL schema load succeeded; RSpec reported 14 examples, 0 failures.
- The two CI jobs completed successfully on commit `85600c6596fcac46180519b06dc77283e9622476`.

CI is evidence for the automated checks only. It does not replace a live manual browser walkthrough, actual screenshots, or the requested video.

## 3. Local verification commands

Prerequisites from the repository READMEs: Ruby 3.3.2, Node.js 18+, PostgreSQL, Redis/Sidekiq, and local application environment values. Keep secrets local; do not commit `api/config/application.yml` or real candidate data.

### Frontend

```bash
cd web
npm install
npm run test
npm run build
```

### API

```bash
cd api
cp config/application.yml.sample config/application.yml
# Edit config/application.yml for your local PostgreSQL, Redis and Gemini settings.
bundle install
RAILS_ENV=test bundle exec rails db:schema:load
RAILS_ENV=test bundle exec rspec
```

For the full local app, start PostgreSQL and Redis, start Sidekiq, then start Rails and Vite using the instructions in `api/README.md` and `web/README.md`. Automated tests mock Gemini; a real API key must not be required for them.

## 4. Seeded-fault test: executed and restored

The brief asks for evidence that a real test catches a deliberate regression, then for the correct logic to be restored with history visible. This was completed on scratch branch `scratch/seed-fit-gap-fault`:

1. Baseline on feature branch: [CI run 40027329905](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40027329905) passed the frontend tests/build and API RSpec.
2. Fault commit: `736cfe26457ce32bc260d4115faae2e0f938e1d5` changed the equality guard from `delta.zero?` to `delta.zero? && false`. Equal-level results incorrectly fell through to `gap`.
3. Failure evidence: [CI run 40027502286](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40027502286) completed with 14 examples / 2 failures. Both failures caught equal-level comparison regressions, including the label-fallback case.
4. Restoration commit: `23e46f89d21216dc59718f9804ceccafbea5dff0` restored the correct code without removing or weakening assertions.
5. Restored evidence: [CI run 40027691951](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40027691951) passed with 14 examples / 0 failures; frontend tests and production build also passed.

The scratch PR was closed after restoration; the branch and both commits remain available for review.

## 5. AI verification moment

A generated component-test assertion first used an ambiguous single-element query for repeated text and an incorrect count expectation. Reviewing the fixture showed four comparison rows, with some labels intentionally repeated in the same row (for example, required and assessed levels can both be L3). The assertion was corrected to check the repeated elements and count deliberately rather than suppressing the behavior.

A separate API/UI contract check found that the backend returns `expected_level` while the previous TypeScript table read `required_level`. The frontend type and table were aligned to the API field, and the component test explicitly checks the required level and the distinct `not_assessed` result.

The current CI result confirms that the corrected automated suite passes. AI output was treated as a draft to verify against source contracts and expected semantics, not as an oracle.

## 6. Visual evidence still required

Use only synthetic/demo candidate data. Do not expose real transcripts, contact details, invite tokens, or secrets.

Capture these from the actual running app:
- Completed report on desktop showing summary counts, required/assessed levels, confidence and override provenance.
- An unassessed skill next to a genuine gap.
- Pending/generating state while the background job is active.
- Failed generation and successful retry.
- Empty comparison state.
- Narrow/mobile viewport with the summary and horizontally scrollable comparison table.

These screenshots have not been captured from a running instance in this environment. They remain required before the final PDF is ready for upload.

## 7. Three-to-five-minute video walkthrough

Suggested recording structure:
- 0:00-0:30: product problem and why a Fit/Gap row can affect a candidate.
- 0:30-1:15: show required vs assessed levels, confidence, override, and `not_assessed`.
- 1:15-2:00: demonstrate loading, failure and retry.
- 2:00-2:45: explain tenant scoping, deterministic calculation, generation version, and AI narrative fallback.
- 2:45-3:30: show the RSpec/Vitest/production-build CI result and seeded fault.
- 3:30-4:00: explain rejected options and the known PostgreSQL/Redis enqueue trade-off.

Host the real recording on Loom, unlisted YouTube, or reviewer-accessible Drive. Add the actual link to the final PDF; do not use a placeholder.

## 8. Final upload gate

- [x] Fork pull request is open and linked.
- [x] Latest configured CI checks pass.
- [x] Seeded-fault failure and restoration evidence are retained.
- [ ] Open an upstream PR to `rakamindev/ai-interview-platform` if permitted.
- [ ] Capture actual browser screenshots.
- [ ] Record and link the 3-5 minute walkthrough.
- [ ] Export, open, and visually inspect the final single PDF.
- [ ] Upload that PDF to the hiring portal.

The provided case-study PDF states Wednesday 19 August, 13:00 WIB. A working note separately referred to 28 October 2026, 23:00 WIB. Verify the real deadline in the hiring portal.
