# Assessment Report — Portfolio Results Reliability

> Status: implementation notes and verification record. Update the evidence section after running the app and tests locally; do not present unrun checks as passing.

## Step 1 — Product problem and prioritization

### Problem observed in code
In `web/src/pages/portfolio/PortfolioPage.tsx`, the initial `Promise.all(...)` catches every failure with an empty handler. If the portfolio, vacancy list, or session request fails, the page stops loading but gives the user no explanation or recovery action. The portfolio screen can appear blank or incomplete, leaving an assessor unsure whether the candidate has no results or the request failed.

### Priority
- **P1 — user-facing reliability:** failed data loading is silently swallowed on a decision-support screen.
- **P2 — export feedback:** export requests have a loading state, but errors are not surfaced to the user.
- Scope for this change: clear load failure state with an explicit retry action, while preserving the existing portfolio workflow.

### People affected
Assessors reviewing candidate evidence and deciding whether to run a fit/gap analysis. Silent failures waste time and can be mistaken for missing candidate data.

## Step 2 — Acceptance criteria and options

### Acceptance criteria
1. Loading continues to use skeleton placeholders.
2. When initial required data fails, show a concise, accessible error message rather than an empty results area.
3. Give the assessor a retry action that re-runs the initial data requests.
4. Retry does not leave the page stuck in loading after another failure.
5. Successful loads continue to show the existing portfolio, discovered skills, transcript link, exports, and fit/gap action.
6. Do not show a success claim for data that has not loaded.

### Options considered
1. **Keep silent catch:** smallest change, but leaves the user unable to diagnose or recover. Rejected.
2. **Add a visible error and retry around the initial load:** directly addresses the user-facing failure with limited code and no API contract changes. Selected.
3. **Redesign portfolio loading into independent partial panels:** better resilience when only one endpoint fails, but expands state complexity and is a larger change than the immediate case-study scope.

### Trade-off
The selected approach treats the initial requests as one required page load, consistent with the current `Promise.all` implementation. It does not yet support partial rendering when one dependency fails.

## Step 3 — Implementation and engineering considerations

- Frontend state should distinguish loading, loaded, and failed instead of silently treating failure as an empty result.
- Retry should use the same fetch path as the initial load to avoid divergent behavior.
- Keep the existing API contract and data model unchanged for this targeted fix; introducing a migration or backend change would not improve this specific failure mode.
- Further hardening opportunities: expose export errors, independently load optional vacancy data, and add component tests once a test runner is configured.

## Step 4 — Verification plan

Run from `web/`:
```bash
npm ci
npm run build
```

Manual checks:
1. Load a session with a completed portfolio: existing results render.
2. Make the portfolio endpoint fail: an error and retry action appear.
3. Retry with the API still unavailable: the error remains visible and the page is not stuck on skeletons.
4. Restore the API and retry: the results render.
5. Test at narrow mobile width and desktop width.
6. Test export success and failure separately.

### Evidence record
- Automated build: **not run in this environment**.
- Browser/manual checks: **not run in this environment**.
- Screenshot/video/CI links: **add after capturing real evidence**.
- AI output verification: the initial code review identified the empty catch in the actual source file. Verify the final implementation against the acceptance criteria and run the commands above before submission.

## Step 5 — Release and submission checklist

- [ ] Review the branch diff and explain each changed state/callback.
- [ ] Run `npm ci && npm run build` from `web/`.
- [ ] Capture before/after screenshots using real application data.
- [ ] Record a 3–5 minute demo showing normal flow and failed-load recovery.
- [ ] Add the final pull request URL after opening the PR.
- [ ] Replace every “not run” evidence item with actual results; never claim unexecuted tests passed.
