# 03 — Self-Derived Acceptance Criteria & Edge Cases

**Role**: Senior Product Engineer  
**Date**: October 2026  
**Scope**: Fullstack Acceptance Criteria (Backend API, Data Models, Frontend UX, Automated Tests)

---

## 1. Core Feature Acceptance Criteria (Gherkin Format)

### Feature 1: Fit/Gap Comparison Data Contract & Visual Presentation
**User Story**: As a Recruiter or Hiring Manager, I want to see the required level alongside the candidate's effective level and clear override indicators in the Fit/Gap comparison table, so that I can evaluate role alignment accurately and transparently.

- **Scenario 1.1: Displaying Vacancy Required Levels**
  - **Given** a Vacancy with required skills and a completed Candidate Portfolio,
  - **When** the Assessor views the Fit/Gap Report page,
  - **Then** the "Required" column must display the formatted level (e.g. `L3`) for every vacancy skill,
  - **And** no table cell in the "Required" column shall render blank, undefined, or empty.

- **Scenario 1.2: Displaying Human Assessor Overrides**
  - **Given** a skill has been calibrated with an assessor override,
  - **When** the Fit/Gap comparison table renders that skill,
  - **Then** the effective candidate level must reflect the override level,
  - **And** a clear override indicator (`✏` with tooltip/badge) must appear next to the level,
  - **And** the comparison result (`match`, `exceed`, `gap`) and delta must calculate based on the overridden level.

- **Scenario 1.3: Handling Unassessed Vacancy Skills**
  - **Given** a Vacancy requires a skill that was not probed during the candidate interview,
  - **When** the Fit/Gap report is generated,
  - **Then** the candidate level must render as `—` (em-dash),
  - **And** the result badge must display `Not assessed` (neutral grey),
  - **And** it must NOT be classified as a negative `gap` (preventing unfair penalty to the candidate under UU PDP fairness guidelines).

---

### Feature 2: Resilient Asynchronous Report Generation & Job Deduplication
**User Story**: As a platform user, I want the system to reliably generate reports without freezing or flooding the server with duplicate background tasks, even if AI services experience delays or failures.

- **Scenario 2.1: Preventing Duplicate Background Job Queuing**
  - **Given** a Fit/Gap report generation is currently in progress,
  - **When** the frontend client polls the endpoint every 5 seconds,
  - **Then** the API must respond with HTTP `202 Accepted` (`status: "generating"`),
  - **And** the backend must NOT enqueue a duplicate Sidekiq job while one is already pending or active,
  - **And** the frontend must continue polling without re-triggering `triggerFitGap`.

- **Scenario 2.2: Graceful Model Timeout & Fallback Narrative**
  - **Given** the Gemini API times out or returns a rate limit (429),
  - **When** `FitGap::Engine` executes,
  - **Then** it must not crash the entire process,
  - **And** it must generate a deterministic rule-based fallback summary (e.g. *"Candidate shows X matches, Y exceeds, and Z gaps against role requirements"*),
  - **And** the report must successfully complete and be presented to the user.

- **Scenario 2.3: Permanent Failure Handling**
  - **Given** a background generation fails unrecoverably,
  - **When** the frontend polls the status,
  - **Then** polling must automatically stop,
  - **And** an error message with a clear "Retry Generation" button must be displayed to the user.

---

### Feature 3: Multi-Tenant Data Isolation (UU PDP Compliance)
**User Story**: As an enterprise customer, I require absolute data segregation so that our candidates' personal interview transcripts, names, and evaluations cannot be accessed or manipulated by other organizations.

- **Scenario 3.1: Scoped Access to Portfolio & Reports**
  - **Given** User A belongs to Tenant 1 and Portfolio X belongs to Tenant 2,
  - **When** User A attempts to access `GET /api/v1/portfolios/X/fitgap/:vacancy_id` or `GET /api/v1/portfolios/X/export`,
  - **Then** the API must reject the request with HTTP `404 Not Found` (preventing ID enumeration),
  - **And** no transcript, candidate name, or rating data shall be returned.

- **Scenario 3.2: Scoped Assessor Overrides**
  - **Given** User A belongs to Tenant 1 and PortfolioSkill Y belongs to Tenant 2,
  - **When** User A attempts to post `POST /api/v1/portfolio_skills/Y/override`,
  - **Then** the API must reject the override with HTTP `404 Not Found`,
  - **And** no override shall be created or modified.

---

### Feature 4: Atomic Transactions & Non-Destructive Overrides
**User Story**: As an Assessor, I want to calibrate candidate ratings without breaking ongoing exports or corrupting existing portfolio data.

- **Scenario 4.1: Atomic Skill Replacement**
  - **Given** a portfolio is regenerated from an updated transcript,
  - **When** `Portfolios::Generator#save_skills` executes,
  - **Then** the deletion of old skills and insertion of new skills must occur inside a single database transaction (`ActiveRecord::Base.transaction`),
  - **And** if an error occurs on any skill, all changes must roll back cleanly without data loss.

- **Scenario 4.2: Non-Destructive Fit/Gap Regeneration**
  - **Given** an existing Fit/Gap report is present,
  - **When** an assessor saves a skill override,
  - **Then** the system must not delete the existing report row immediately,
  - **And** ongoing PDF exports or page views shall remain functional,
  - **And** the updated report shall overwrite the record atomically once the worker finishes.

---

## 2. Comprehensive Edge Cases & UI Interaction States

| Category | Edge Case Scenario | Expected System Behavior & UI Design Specification |
|---|---|---|
| **Unassessed Skills** | Vacancy requires 5 skills; interview only had time to probe 3 skills. | The 2 unassessed skills render with `candidate_level: null`, display label `—`, result badge `Not assessed` (neutral border/text), delta `—`. Not counted as a negative gap. |
| **Missing / Null Ratings** | AI fails to assign a rating to a skill or returns malformed level. | Clamped safely between 1 and 5. If completely absent, falls back to `L1` with low confidence warning or flags as unassessed rather than crashing ActiveRecord validation. |
| **Model Failure** | Gemini API returns 429 (Rate Limit) or 504 (Timeout). | Background worker captures `Faraday::Error`, falls back to rule-based comparison narrative, logs error without candidate PII, and allows report completion. |
| **Unusual Data Types** | AI returns string `"3"`, `"Level 3"`, or integer `3`. | `parseLevel` helper robustly sanitizes input to integer `3`. Database check constraints (`chk_..._level`) are strictly honored. |
| **Long Text & Overflow** | Culture narrative contains 800+ words or candidate quotes exceed 4 lines. | UI applies clean whitespace-pre-wrap, clamped line heights, responsive card padding, and proper PDF page breaking without overlapping headers. |
| **Loading State** | Initial page load or report generation in progress. | Skeleton loaders matching card shapes; pulsing spinner with informative progress text (*"Analyzing candidate fit against vacancy requirements..."*). |
| **Empty State** | Candidate has 0 portfolio skills or no vacancies exist in tenant. | Thoughtful empty illustration/card with explicit call to action (*"No vacancies configured yet. Create a vacancy to run fit/gap analysis"*). |
| **Error State** | Network disconnect or server 500. | Clean alert box with specific error explanation and an actionable "Try Again" / "Regenerate" button. No infinite polling. |
| **Partial State** | Report exists for some vacancies but not the currently selected one. | Immediate detection of missing vacancy report, triggering creation seamlessly without wiping reports for other vacancies. |
| **Responsive Views** | Viewed on tablet/mobile screens (375px to 768px). | Comparison table horizontally scrolls with fixed skill header; badges wrap cleanly without truncating text. |

---

## 3. Automated Test Verification Matrix

Every acceptance criterion will be proven by an automated test harness:
1. **Model Specs** (`spec/models/`): Validations, enum values, and tenant scoping.
2. **Service Specs** (`spec/services/`): `FitGap::Engine` contract harmonization, fallback narratives, and override calculations.
3. **Request/Controller Specs** (`spec/requests/`): Multi-tenant security boundaries, status code transitions (202 Accepted vs 200 OK vs 404), and JSON payload contracts.
4. **Frontend Unit/Component Specs**: Rendering of `ComparisonTable` with required levels and override indicators.
