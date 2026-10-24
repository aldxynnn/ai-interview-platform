# 02 — Problem Analysis & Severity-Ranked Findings (P0–P3)

**Role**: Senior Product Engineer  
**Date**: October 2026  
**Scope**: Fullstack Audit (`api/` Rails, `web/` React, Database Models, and Sidekiq Workers)

---

## 1. Executive Summary of Audit Findings

The platform provides a comprehensive capability for AI-assisted interviews, but contains critical defects at the intersection of **vacancy matching (Fit/Gap analysis)**, **assessor calibration (human-in-the-loop overrides)**, and **multi-tenant data security**.

| ID | Severity | Category | Component | One-Line Impact Statement |
|---|---|---|---|---|
| **ISSUE-01** | **P0** | Defective Implementation | `FitGap::Engine` / `ComparisonTable.tsx` | The Fit/Gap table renders required skill levels completely blank and hides human overrides due to a broken API-frontend contract. |
| **ISSUE-02** | **P0** | Defective Implementation & Design Failure | `FitGapReportPage.tsx` / `PortfoliosController` | Polling loop floods Sidekiq with duplicate jobs every 5 seconds on 404, causing infinite loops upon model delay or failure. |
| **ISSUE-03** | **P0** | Defective Implementation & Security | `PortfoliosController` / `PortfolioSkillsController` | Assessor endpoints lack tenant isolation verification, allowing cross-organization candidate data leakage in violation of UU PDP. |
| **ISSUE-04** | **P1** | Defective Implementation | `PortfolioSkillsController#override` | Saving an assessor override synchronously deletes existing Fit/Gap reports, breaking PDF exports and creating race conditions. |
| **ISSUE-05** | **P1** | Defective Implementation | `Portfolios::Generator#save_skills` | Skill regeneration deletes existing skills before inserting new records outside a transaction, risking partial write data loss. |
| **ISSUE-06** | **P1** | Defective Implementation & Missing Spec | `FitGapReportPage.tsx` | Discovered skills render raw unformatted integer levels and ignore human overrides in Fit/Gap presentation. |
| **ISSUE-07** | **P2** | Inconsistency | `Exports::PdfGenerator` | PDF generator uses `c['expected_level']` while frontend expects `required_level`, creating export-screen divergence. |
| **ISSUE-08** | **P2** | Missing Specification | `api/README.md` vs `application.yml.sample` | Documentation specifies `GEMINI_ANALYSIS_MODEL` while code and sample config use `GEMINI_FLASH_MODEL`. |
| **ISSUE-09** | **P3** | Missing Harness | `api/spec/` & `web/package.json` | Total absence of automated tests in backend and lack of test runner in frontend makes releases unverified. |

---

## 2. Detailed Findings & Evidence

### [P0] ISSUE-01: Broken Frontend-Backend Data Contract in Fit/Gap Comparison
- **Classification**: Defective Implementation (Contract Seam Mismatch).
- **Locations**:
  - `api/app/services/fit_gap/engine.rb` (lines 58–67)
  - `web/src/components/fitgap/ComparisonTable.tsx` (lines 48–66)
  - `web/src/types/index.ts` (lines 130–137)
- **Code Evidence**:
  - *Backend Engine Output*:
    ```ruby
    # api/app/services/fit_gap/engine.rb:58-67
    {
      skill_label:     label,
      skill_id:        vacancy_skill.skill_id,
      candidate_level: candidate_level,
      expected_level:  expected_level,  # <-- BACKEND SENDS expected_level
      result:          result,
      delta:           delta,
      confidence:      portfolio_skill&.dig(:confidence)
      # <-- MISSING is_override / overridden
    }
    ```
  - *Frontend Rendering Component*:
    ```tsx
    // web/src/components/fitgap/ComparisonTable.tsx:49-57
    <td className="px-4 py-2.5 text-center text-muted-foreground">
      {LEVEL_LABELS[c.required_level]}  {/* <-- EXPECTS required_level */}
    </td>
    <td className="px-4 py-2.5 text-center">
      {c.candidate_level != null ? (
        <span>
          {LEVEL_LABELS[c.candidate_level]}
          {c.is_override && <span className="text-xs text-muted-foreground ml-1">✏</span>} {/* <-- NEVER FIRES */}
        </span>
      ) : ...}
    </td>
    ```
- **Observed Behavior**:
  Because `c.required_level` is `undefined`, `LEVEL_LABELS[undefined]` evaluates to `undefined`. In React, the entire "Required" column renders blank. Furthermore, `c.is_override` is always `undefined`, so the human override indicator (`✏`) never appears.
- **User & Candidate Impact**:
  Hiring managers and recruiters cannot see what level was required by the job vacancy when evaluating a candidate, rendering the screen useless. Human assessor overrides are obscured, violating the transparency mandated by UU PDP Pasal 10.

---

### [P0] ISSUE-02: Rapid-Fire Sidekiq Job Flooding & Infinite Polling Loop on 404
- **Classification**: Defective Implementation & Designed Failure Path Absence.
- **Locations**:
  - `web/src/pages/fitgap/FitGapReportPage.tsx` (lines 28–44, 62)
  - `api/app/controllers/api/v1/portfolios_controller.rb` (lines 102–140)
  - `api/db/schema.rb` (lines 85–95)
- **Code Evidence**:
  - *Frontend Polling & 404 Handling*:
    ```tsx
    // web/src/pages/fitgap/FitGapReportPage.tsx:28-44
    const fetchReport = useCallback(async () => {
      if (!portfolio) return;
      try {
        const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
        setReport(res.data.report);
        setGenerating(false);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          try {
            await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId)); // <-- ENQUEUES JOB!
            setGenerating(true);
          } catch {
            setGenerating(false);
          }
        }
      }
    }, [portfolio, vacancyId]);

    usePolling(fetchReport, 5000, generating && !!portfolio);
    ```
  - *Backend Controller*:
    ```ruby
    # api/app/controllers/api/v1/portfolios_controller.rb:122
    FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) # <-- ENQUEUE
    ```
  - *Underlying Schema*: `fit_gap_reports` has NO status column. When a report is being generated, no record exists in the DB.
- **Observed Behavior**:
  1. While Gemini is processing (which typically takes 5–15 seconds), `getFitGap` returns 404.
  2. The frontend catch block catches 404 and invokes `triggerFitGap`.
  3. Every 5 seconds, another duplicate `FitGapGeneratorWorker` job is enqueued in Redis.
  4. If Gemini encounters a rate limit (429) or timeout, the worker fails and no DB row is written. The frontend polls forever every 5 seconds, triggering an infinite storm of background jobs.
- **User & Candidate Impact**:
  Exhausts background worker threads and Redis memory; causes server-side Denial of Service (DoS); users experience permanent spinning loaders with no actionable error feedback.

---

### [P0] ISSUE-03: Missing Tenant Scoping on Portfolio and Override Endpoints (IDOR / UU PDP)
- **Classification**: Defective Implementation & Legal Compliance Failure.
- **Locations**:
  - `api/app/controllers/api/v1/portfolios_controller.rb` (lines 82, 104, 130, 156)
  - `api/app/controllers/api/v1/portfolio_skills_controller.rb` (lines 50–55)
  - `api/app/models/portfolio.rb`
- **Code Evidence**:
  - `Portfolio` model does not include `TenantScoped`.
  - In `PortfoliosController`:
    ```ruby
    def fitgap
      portfolio = Portfolio.find(params[:id]) # <-- No tenant check!
      ...
    def show_fitgap
      portfolio = Portfolio.find(params[:id]) # <-- No tenant check!
      ...
    def export
      # @portfolio = Portfolio.find(params[:id]) # <-- No tenant check!
    ```
  - In `PortfolioSkillsController`:
    ```ruby
    def set_portfolio_skill
      @portfolio_skill = PortfolioSkill.joins(:portfolio).find(params[:id]) # <-- No tenant check!
    ```
- **Observed Behavior**:
  Any user holding a valid JWT token for Organization A can pass the ID of a portfolio belonging to Organization B and view full assessment transcripts, candidate names, ratings, or even submit score overrides.
- **User & Candidate Impact**:
  Direct breach of UU PDP Pasal 35 & 39 regarding data confidentiality and unauthorized access. Serious regulatory and commercial liability for enterprise clients.

---

### [P1] ISSUE-04: Synchronous Deletion of Reports on Override Creating Stale State & Race Conditions
- **Classification**: Defective Implementation & Architectural Debt.
- **Locations**:
  - `api/app/controllers/api/v1/portfolio_skills_controller.rb` (lines 41–48)
- **Code Evidence**:
  ```ruby
  def regenerate_stale_fitgap_reports
    portfolio = @portfolio_skill.portfolio
    FitGapReport.where(portfolio_id: portfolio.id).each do |report|
      vacancy_id = report.vacancy_id
      report.destroy # <-- DELETES ROW SYNCHRONOUSLY
      FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id)
    end
  end
  ```
- **Observed Behavior**:
  When an assessor overrides a skill, existing Fit/Gap reports are wiped out immediately. If another user views or exports the report before Sidekiq finishes, the report is missing (404) or the PDF is generated without vacancy data. If multiple skill overrides are saved in quick succession, duplicate jobs are enqueued concurrently for the same report.
- **User & Candidate Impact**:
  Assessors see their Fit/Gap analysis vanish unexpectedly upon saving an override; simultaneous exports fail or generate incomplete PDFs.

---

### [P1] ISSUE-05: Non-Atomic Skill Replacement in Portfolio Generator
- **Classification**: Defective Implementation (Partial Write Risk).
- **Locations**:
  - `api/app/services/portfolios/generator.rb` (lines 150–179)
- **Code Evidence**:
  ```ruby
  def save_skills(portfolio, response)
    data = response.is_a?(Hash) ? response : JSON.parse(response)
    portfolio.portfolio_skills.destroy_all # <-- Outside transaction block

    (data['configured_skills'] || []).each do |skill_data|
      portfolio.portfolio_skills.create!(...)
    end
  ```
- **Observed Behavior**:
  If any skill fails database validation (e.g. invalid level, empty competency summary) or encounters a database lock during the iteration, the existing skills have already been destroyed and the portfolio is left permanently corrupted with partial data.
- **User & Candidate Impact**:
  Candidate portfolios lose their interview ratings permanently upon unexpected model generation formatting glitches.

---

### [P1] ISSUE-06: Discovered Skills Formatting & Override Oversight in Fit/Gap Screen
- **Classification**: Defective Implementation & Missing Specification.
- **Locations**:
  - `web/src/pages/fitgap/FitGapReportPage.tsx` (lines 193–200)
- **Code Evidence**:
  ```tsx
  <span className="text-muted-foreground">
    {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
  </span>
  ```
- **Observed Behavior**:
  Discovered skills are rendered as raw integer `3` rather than `L3` or standard badges. Additionally, it reads `s.ai_level` directly from the skill object, completely ignoring any assessor overrides applied to discovered skills.
- **User & Candidate Impact**:
  Visual inconsistency in UI hierarchy and misleading representations of candidate competency levels.

---

## 3. Constraint Signals for Escalation to Technical Lead

During this audit, three key architectural constraints were identified that must be highlighted to the Technical Lead:

1. **State Machine Modeling on `FitGapReport`**:
   `FitGapReport` was designed without lifecycle status fields (`generation_status`, `generation_error`), unlike `Portfolio`. Relying on row existence or deletion to communicate state across asynchronous boundaries is the root cause of ISSUE-02 and ISSUE-04. Adding lightweight status tracking or returning an explicit in-progress payload avoids destructive row drops.

2. **Cross-Service Authorization & Tenant Scoping**:
   ActiveRecord models that do not have direct `tenant_id` columns (`portfolios`, `portfolio_skills`, `fit_gap_reports`) must be secured at the controller boundary by scoping through their root parent (`session` or `vacancy`), ensuring zero unauthorized data access.

3. **Human-in-the-Loop Audit Trails under UU PDP**:
   To satisfy compliance with UU PDP Pasal 10, the platform's data models and export pipelines must formally preserve assessor attribution (`overridden_by`, `override_level`, `assessor_notes`) so any decision can be explained to candidates and auditors.
