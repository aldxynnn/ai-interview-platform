# Rakamin Product Engineer Case Study — Implementation Notes

**Submission deadline supplied by candidate:** 28 October 2026, 23:00 WIB  
**Focus slice:** trustworthy Fit/Gap candidate assessment reports  
**Branch:** `feat/trustworthy-fit-gap`

This folder contains the written narrative and evidence checklist. Code changes belong in `api/` and `web/`; the final hiring-platform upload must be a single PDF, as requested by the brief.

## Executive summary

The product helps assessors compare the skills evidenced in an AI-assisted interview against a vacancy's required skills. The highest-impact slice selected here is not a visual-only redesign: it is making the Fit/Gap result safer to access, correct to interpret, resilient to AI/queue failures, and easier to review.

The selected change addresses four connected seams:

1. **Tenant ownership:** authenticated portfolio/report/export/override actions must remain inside the current tenant.
2. **Contract correctness:** the API returns `expected_level`; the previous frontend contract and table expected `required_level`. The report now uses the actual API field.
3. **Generation lifecycle:** reports have explicit `pending`, `generating`, `complete`, and `failed` states, an incrementing generation version, a coordinator, and a worker that ignores duplicates or stale versions.
4. **Candidate-impact UX:** the report explains confidence, assessor overrides, gaps, matches, above-requirement results, and skills that were not assessed. It explicitly says that the report supports a human decision rather than making it.

## Contents

- `product-analysis.md`: product context, P0–P3 findings, and constraint signals.
- `technical-decisions.md`: considered options and rationale for the chosen implementation.
- `acceptance-criteria.md`: self-derived behavior and edge-case criteria.
- `verification-plan.md`: commands, test evidence to capture, seeded fault procedure, and video/screenshot checklist.

## Important verification status

The code has been committed to the feature branch through GitHub. In this environment, direct repository cloning was blocked by DNS/network access, so the full application could not be started here. The tests and workflow were added, but a green build/test result must not be claimed until GitHub Actions or a local run confirms it. Capture real screenshots from the running application and add the 3–5 minute video link before uploading the final PDF.

## Submission artifacts still to collect

- [ ] Open Pull Request link and final commit SHA.
- [ ] Green result from frontend tests and production build.
- [ ] Green result from RSpec and database schema load.
- [ ] Seeded-fault test: capture failing output from a scratch branch, then show the restoring commit/history.
- [ ] Screenshots from the actual running app: complete report, unassessed skill, loading/pending state, failed/retry state, narrow/mobile layout.
- [ ] Public or reviewer-accessible 3–5 minute walkthrough link.
- [ ] Final PDF updated to include the actual PR, screenshots, test results, seeded fault evidence, and video link.

Do not submit claims or evidence that have not been produced.
