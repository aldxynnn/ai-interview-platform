# Visual Evidence Catalog (BEFORE & AFTER Comparisons)

**Location of Artifacts**: `assessment/deliverables/screenshots/`  
**Total Screenshots**: 14 (5 Before, 9 After)  
**Image Format**: Authentic 24-bit PNG, high-resolution rendering  

---

## 1. Summary of Before & After Pairs

| # | Comparison Area | BEFORE Artifact (Flaw / Defect) | AFTER Artifact (Monozukuri Transformation) | Key Improvement |
|---|---|---|---|---|
| **01** | **Required Level & Human Overrides** | `before/BEFORE_01_FitGap_Blank_Required_Level.png` | `after/AFTER_02_FitGap_Explicit_Level_Progression.png` | Fixed blank "Required" column; added 5-column progression with explicit level badges, confidence dots, and `✏ Calibrated` chips. |
| **02** | **Recruiter Executive View** | `before/BEFORE_01_FitGap_Blank_Required_Level.png` | `after/AFTER_01_FitGap_Recruiter_Executive_Summary.png` | Introduced recruiter executive summary card: 83% Competency Fit Rate, recommendation badge, and 6 KPI metric boxes. |
| **03** | **Interactive Skill Filtering** | *(Feature did not exist)* | `after/AFTER_03_FitGap_Interactive_Tabbed_Filtering.png` | Added interactive tabs (`All`, `Fit`, `Gaps`, `Overrides`, `Unassessed`) allowing 1-click triage of candidate gaps. |
| **04** | **Assessor Calibration Notes** | `before/BEFORE_01_FitGap_Blank_Required_Level.png` (Notes hidden) | `after/AFTER_02_FitGap_Explicit_Level_Progression.png` | Rendered styled audit callout boxes under skill names displaying human assessor justification. |
| **05** | **Sidekiq 404 Enqueue Flood** | `before/BEFORE_02_Sidekiq_Job_Flooding_Loop.png` | `after/AFTER_05_FitGap_Controlled_Generating_and_Timeout.png` | Replaced 404 flood loop with HTTP 202 protocol + bounded polling (max 15 attempts) with visual progress bar. |
| **06** | **Infinite Generating Spinner** | `before/BEFORE_05_Infinite_Generating_Spinner.png` | `after/AFTER_05_FitGap_Controlled_Generating_and_Timeout.png` | Replaced infinite generic spinner with polite AI synthesis explanation and attempt tracker. |
| **07** | **Error & Retry States** | *(Generic crash / blank)* | `after/AFTER_06_FitGap_Error_and_Retry_States.png` | Added resilient error card with explicit "Try Again" and "Back to Portfolio" actions. |
| **08** | **Empty State Guidance** | *(Blank table)* | `after/AFTER_07_FitGap_Empty_State.png` | Added illustrated empty state guiding users to configure vacancy skills. |
| **09** | **Mobile Responsiveness** | *(Broken table / truncated cells)* | `after/AFTER_08_FitGap_Mobile_Responsive_View.png` | Designed responsive 390px mobile layout with stacked competency cards. |
| **10** | **Multi-Tenant Security (UU PDP)** | `before/BEFORE_03_Cross_Tenant_Portfolio_Leakage.png` | `after/AFTER_09_MultiTenant_UU_PDP_404_Enforcement.png` | Automated RSpec verification proving cross-tenant access returns 404 Not Found. |
| **11** | **Non-Destructive Invalidation** | `before/BEFORE_04_Destructive_Override_Deletion.png` | `after/AFTER_10_Non_Destructive_Atomic_Regeneration.png` | Automated RSpec verification proving existing reports are preserved during calibration. |

---

## 2. Detailed Screenshot Documentation

### Pair 01: Core Contract Mismatch (Blank Required Column vs Explicit Progression)
- **BEFORE**: `BEFORE_01_FitGap_Blank_Required_Level.png`
  - *Observed Flaw*: The "Required" column displays `—` for every row because the frontend component looked for `c.required_level` while the backend emitted `expected_level`. Human overrides were completely invisible.
- **AFTER**: `AFTER_02_FitGap_Explicit_Level_Progression.png`
  - *Monozukuri Resolution*: The table now features 5 clear columns:
    1. **Vacancy Competency**: Skill label + Assessor Note callout.
    2. **Required Level**: `LevelBadge` (`sm`) with level number and description (e.g. `L3 Proficient`).
    3. **AI Assessed**: Original AI rating with confidence dot (`● Confidence: HIGH`). If overridden, original level has a subtle line-through.
    4. **Calibrated (Final)**: Calibrated level with `✏️ Calibrated` chip.
    5. **Fit Status**: Color-coded badges (`✅ Match`, `⭐ Exceeds +1`, `⚠ Gap -2`).

### Pair 02: Polling Loop Flooding vs Controlled Bounded Synthesis
- **BEFORE**: `BEFORE_02_Sidekiq_Job_Flooding_Loop.png`
  - *Observed Flaw*: When report was absent, `show_fitgap` returned 404. The React `catch` block triggered `triggerFitGap`, queuing duplicate Sidekiq workers every 5 seconds indefinitely (12 duplicate jobs in 60s).
- **AFTER**: `AFTER_05_FitGap_Controlled_Generating_and_Timeout.png`
  - *Monozukuri Resolution*: The backend now returns HTTP 202 Accepted. The frontend recognizes 202 without catching 404 or re-triggering. Polling is bounded by a 15-attempt safety guard with an animated progress bar.

### Pair 03: Multi-Tenant Data Leakage vs Strict UU PDP Isolation
- **BEFORE**: `BEFORE_03_Cross_Tenant_Portfolio_Leakage.png`
  - *Observed Flaw*: Direct `Portfolio.find(params[:id])` allowed Tenant B to fetch candidate portfolios belonging to Tenant A with `200 OK`.
- **AFTER**: `AFTER_09_MultiTenant_UU_PDP_404_Enforcement.png`
  - *Monozukuri Resolution*: Tenant scoping via `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Cross-tenant probes now strictly return `404 Not Found`.

### Pair 04: Destructive Invalidation vs Non-Destructive Invalidation
- **BEFORE**: `BEFORE_04_Destructive_Override_Deletion.png`
  - *Observed Flaw*: `PortfolioSkillsController#override` called `report.destroy`, wiping the database row and breaking active PDF exports.
- **AFTER**: `AFTER_10_Non_Destructive_Atomic_Regeneration.png`
  - *Monozukuri Resolution*: `report.destroy` removed; background jobs are enqueued non-destructively, keeping existing reports available until the new version is synthesized.
