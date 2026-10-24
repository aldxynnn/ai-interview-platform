# Video Demonstration Walkthrough Script & Storyboard

**Format**: 3 to 5 Minute Product & Engineering Walkthrough Video  
**Target Duration**: 4 Minutes 15 Seconds  
**Platform Recommendation**: Loom / YouTube Unlisted / Google Drive  
**Presenter**: Senior Fullstack Product Engineer  
**Target Audience**: Product Team & Engineering Leadership (CTO & Technical Lead)  

---

## 1. Storyboard & Timestamp Breakdown

| Segment | Timestamp | Screen Focus / Visual Cue | Core Theme & Purpose |
|---|---|---|---|
| **Part 1** | `0:00 – 0:45` | Title slide / Candidate evaluation screen | Introduction, case study objective, and product philosophy. |
| **Part 2** | `0:45 – 1:45` | Baseline before code & broken Fit/Gap screen | Root cause analysis: contract seam mismatch, 404 polling flood, UU PDP vulnerability. |
| **Part 3** | `1:45 – 2:45` | Architecture diagram & Git diff | Fullstack technical solution: harmonized payload, 202 protocol, tenant scoping. |
| **Part 4** | `2:45 – 3:45` | Live revamped Fit/Gap Report UI | Monozukuri UX walkthrough: recruiter summary, level progression, tabbed filter, error states. |
| **Part 5** | `3:45 – 4:15` | Terminal test run & PR view | Automated RSpec verification (14 tests), seeded fault proof, and handover. |

---

## 2. Minute-by-Minute Speaking Script

### Part 1: Introduction & Product Philosophy (0:00 – 0:45 | 45s)
- **Visual**: Camera on presenter + screen showing `FitGapReportPage.tsx` title header.
- **Presenter Spoken Script**:
  > *"Hello team, welcome to this product and engineering walkthrough for the AI Interview Platform.
  >
  > As a Product Engineer, our goal isn't just fixing bugs or writing lines of code; it's delivering high-impact value for the people who rely on this software every day: recruiters making hiring calls, assessors calibrating evaluations, and candidates whose careers depend on fair, accurate assessments under Indonesia's Personal Data Protection Law (UU PDP).
  >
  > In this walkthrough, I’ll show how we took a broken, infinitely looping Fit/Gap analysis flow and transformed it into a robust, high-craftsmanship product experience—what we call Monozukuri."*

### Part 2: Root Cause Analysis of Baseline Flaws (0:45 – 1:45 | 60s)
- **Visual**: Display `BEFORE_01_FitGap_Blank_Required_Level.png` and `BEFORE_02_Sidekiq_Job_Flooding_Loop.png`.
- **Presenter Spoken Script**:
  > *"Let's look at what was happening in the baseline.
  >
  > First, in the Fit/Gap comparison table, the 'Required' level column was completely blank. Why? Because the Rails backend in `FitGap::Engine` was emitting `expected_level`, while the React component looked for `c.required_level`. Furthermore, `c.is_override` was never populated, making human calibrations completely invisible.
  >
  > Second, we found a severe design flaw in the polling loop: when a report wasn't ready yet, the API returned a 404. The frontend caught that 404 and immediately triggered a new generation job—spamming Sidekiq every 5 seconds. If the Gemini model delayed, it flooded the Redis queue with duplicate jobs.
  >
  > Third, a critical compliance issue: assessor endpoints used raw `Portfolio.find(params[:id])` without session tenant scoping, meaning Tenant B could inspect and export candidate portfolios from Tenant A—a direct violation of UU PDP."*

### Part 3: The Fullstack Architectural Solution (1:45 – 2:45 | 60s)
- **Visual**: Show `api/app/services/fit_gap/engine.rb` and `PortfoliosController` diffs.
- **Presenter Spoken Script**:
  > *"To solve this cleanly, we designed a fullstack vertical slice:
  >
  > On the backend:
  > 1. We harmonized the contract: `FitGap::Engine` now emits both `required_level` and `expected_level`, plus `is_override`, `ai_level`, and `assessor_notes`.
  > 2. We replaced 404 polling with the HTTP 202 Accepted protocol. When a report is being generated, the API responds with 202 `{ status: 'generating' }`. The frontend recognizes this without throwing an error or spamming duplicate jobs.
  > 3. We enforced strict multi-tenant isolation: all portfolio queries are scoped through `joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Cross-tenant requests now securely return 404.
  > 4. We wrapped skill writes in database transactions to prevent partial write data loss, and made override regeneration non-destructive."*

### Part 4: Live Monozukuri UI/UX Walkthrough (2:45 – 3:45 | 60s)
- **Visual**: Open live running app on `http://localhost:5173` or show `AFTER_01` through `AFTER_04` screenshots.
- **Presenter Spoken Script**:
  > *"Now let's look at the transformed user experience.
  >
  > At the top, we introduced the Recruiter Executive Summary. A recruiter immediately sees the Competency Fit Rate—here 83%—along with a clear verdict badge like 'Strong Role Fit' and 6 quick KPI chips. In 3 seconds, a recruiter knows whether this candidate meets role benchmarks.
  >
  > Below that, the table now has 5 crystal-clear columns:
  > - Required Level with visual badges.
  > - AI Assessed Level with confidence dots.
  > - Calibrated Final Level showing the human calibration chip.
  > - And notice this: when an assessor calibrated PostgreSQL from L3 to L4, an audit callout box appears right under the skill name explaining why: 'Candidate articulated MVCC locks exceeding AI probe depth.'
  >
  > We also added interactive tabs: recruiters can click 'Gaps' to immediately isolate areas needing development, or 'Overrides' to review assessor adjustments.
  >
  > Finally, loading and error states are fully resilient: bounded polling with progress indication, a 60-second timeout guard, and explicit Retry buttons."*

### Part 5: System Rigor, Automated Testing & Handover (3:45 – 4:15 | 30s)
- **Visual**: Terminal showing `bundle exec rspec` passing all 14 tests, and Git branch status.
- **Presenter Spoken Script**:
  > *"All of this is backed by automated tests. We built an RSpec harness with 14 examples covering the Engine, tenant isolation, and non-destructive overrides—all passing with zero failures.
  >
  > We even proved our tests catch regressions through a seeded fault test on a scratch branch, breaking logic and verifying failure before reverting with visible Git history.
  >
  > All deliverables, including the compliance matrix, before/after visual catalog, and the single PDF report, are ready in `/assessment/deliverables`.
  >
  > Thank you for your time, and I look forward to our live technical defense!"*
