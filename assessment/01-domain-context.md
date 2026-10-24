# 01 — Domain Context, User Personas, & Legal Framework (UU PDP)

**Role**: Senior Product Engineer  
**Date**: October 2026  
**Context**: AI-Powered Talent Assessment & Interview Platform (Indonesia Market)

---

## 1. Domain & Product Context

### 1.1 The Outcome This Product Exists to Produce
In technical recruitment, resumes and static screening tests have become commoditized and vulnerable to manipulation (e.g., generative AI cover letters, exaggerated buzzwords, leetcode memorization). 

This platform exists to provide **authentic, adaptive competency assessments** through conversational AI that dynamically probes candidate depth across standardized behavioral anchors (Levels 1 to 5). The core value proposition is:
1. **Depth over Keywords**: Moving beyond resume claims to structured, evidence-backed capability evaluations.
2. **Efficiency with Calibration**: Saving engineering hours by having AI conduct first-round deep probes while keeping human assessors in full control via calibration and overrides.
3. **Vacancy Matching**: Directly comparing observed candidate competencies against specific organizational job requirements (Fit/Gap analysis).

### 1.2 The Indonesian Talent Market Dynamics
- **High-Volume Asymmetry**: Entry-level and mid-level software engineering openings in Indonesia frequently receive 500+ applicants within days. Technical leads spend 10–15 hours weekly conducting repetitive screening interviews.
- **Language & Cultural Nuances**: Indonesian engineers frequently switch between Bahasa Indonesia and English (*code-switching* or *Bahasa campur*). Probing must discern actual technical competency despite varied verbal fluency.
- **Where the Real Leverage Sits**: The leverage does not lie in generating more text; it lies in **explainable, audited evidence** that allows a hiring committee to make decisive hiring calls in minutes rather than hours.

---

## 2. Stakeholder Empathy & User Personas

| Persona | Core Goal & Daily Reality | Critical Pain Points in Current System | What "Top-Notch" Looks Like |
|---|---|---|---|
| **Assessor** (Senior Engineer / Lead) | Reviews AI-evaluated sessions, calibrates scores, and verifies candidate technical claims. | AI misinterpretations cannot be reliably calibrated if overrides don't carry through to reports; destroying reports during override causes confusion and delays. | One-click override with clear audit trails, instant recalculation of Fit/Gap metrics, and transparent evidence diffs. |
| **Recruiter** (Talent Acquisition) | Screens candidates against open vacancies and prepares candidate packets for hiring managers. | Blanks in Fit/Gap tables ("Required: —"), hanging report generation states, and duplicate job errors during vacancy matching. | Fast, reliable Fit/Gap comparison, clear Match/Exceed/Gap badges, and instant PDF/JSON downloads for hiring committees. |
| **Hiring Manager** (VP / Engineering Director) | Makes final offer decisions based on team gaps and role requirements. | Black-box scores without clear vacancy benchmarking; cannot distinguish between AI-generated scores and human-verified calibrations. | Highly interpretable vacancy fit summary, explicit indicators where human assessors overrode AI, and clear culture/competency narratives. |
| **Candidate** (*The Vulnerable Stakeholder*) | Undergoes automated probing; did not choose the AI system and cannot opt out. A false negative costs them a job opportunity. | Hallucinated ratings for skills never probed; unassessed skills marked ambiguously; privacy leaks of their voice and transcript. | Fair, anchor-based evaluation; clear distinction between "unassessed" and "lacking competence"; strict privacy protection of their interview data. |

---

## 3. Regulatory Framework: UU Pelindungan Data Pribadi (UU PDP)

The platform operates directly within the jurisdiction of the Republic of Indonesia and processes sensitive candidate interview data. Compliance with **Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** is a non-negotiable architectural requirement.

*External Reference*: [JDIH Kementerian Sekretariat Negara RI - UU No. 27 Tahun 2022](https://jdih.setneg.go.id/Terbit/periksa/uu-27-2022) | [Kementerian Komunikasi dan Digital (Komdigi)](https://www.komdigi.go.id/)

### 3.1 Key Legal Pillars Impacting Platform Architecture

1. **Automated Decision-Making (Pasal 10 UU PDP)**:
   - *Legal Mandate*: Data subjects have the right to object to decisions that are based solely on automated processing, including profiling, which produce legal effects or significantly affect them.
   - *Product Implication*: **The AI must never make a final, unreviewable hiring decision.** The human assessor override mechanism is not merely an optional feature—it is the legal foundation ensuring human-in-the-loop accountability.
   - *Architecture Requirement*: Overrides must be first-class citizens in the data model and clearly marked with assessor attribution (`overridden_by`, `overridden_at`, `assessor_notes`) on both screen and exported documents.

2. **Security & Confidentiality of Personal Data (Pasal 35 & 39 UU PDP)**:
   - *Legal Mandate*: The Data Controller (Pengendali Data Pribadi) is obligated to protect personal data from unauthorized access, disclosure, alteration, or loss by establishing robust technical security measures.
   - *Product Implication*: Multi-tenant data segregation must be impenetrable. Candidate transcripts, audio recordings, personal contact information, and competency ratings belonging to Organization A must never be accessible, visible, or modifiable by Organization B.
   - *Current Violation*: The audit identified that `portfolios#show`, `portfolios#fitgap`, `portfolios#export`, and `portfolio_skills#override` operate without tenant verification on the associated session, creating a severe horizontal privilege escalation vulnerability (IDOR).

3. **Data Accuracy & Minimization (Pasal 16 ayat 2 UU PDP)**:
   - *Legal Mandate*: Personal data processing must ensure accuracy, completeness, and consistency to prevent harm to data subjects.
   - *Product Implication*: If an assessment concludes without probing a specific vacancy skill, marking the candidate as having a "Gap" (failing) is inaccurate and defamatory. Unprobed skills must explicitly remain `not_assessed`, avoiding penalizing the candidate for interview time limits.

---

## 4. Methodological Distinction: Facts, Inferences, & Assumptions

To maintain engineering and product integrity, all observations in this audit are classified strictly into three tiers:

### Facts (Directly observed from codebase and runtime execution)
- `ComparisonTable.tsx` reads `c.required_level`, but `FitGap::Engine#build_skill_comparisons` returns `expected_level`.
- `ComparisonTable.tsx` checks `c.is_override`, but `FitGap::Engine` never outputs this key in its hash.
- `FitGapReportPage.tsx` catches 404 from `portfoliosApi.getFitGap` and triggers `triggerFitGap`, while polling every 5 seconds.
- `fit_gap_reports` table has no status column (`generation_status` or similar), relying on row deletion to signal regeneration.
- `portfolio_skills_controller.rb#override` deletes `FitGapReport` rows synchronously upon saving an override.
- `PortfoliosController` actions (`fitgap`, `export`, `show_fitgap`) perform `Portfolio.find(params[:id])` without checking `session.tenant_id == current_tenant_id`.
- The repository has no spec files in `api/spec/` and no test runner configured in `web/package.json`.

### Inferences (Logical conclusions derived directly from verified facts)
- When users view the Fit/Gap Report, the "Required" column renders blank because `LEVEL_LABELS[undefined]` returns `undefined`.
- Human overrides are invisible in the Fit/Gap table because `is_override` is absent in API responses, misleading recruiters into believing ratings were purely AI-generated.
- If Sidekiq takes longer than 5 seconds or Gemini API fails, the frontend repeatedly dispatches duplicate Sidekiq jobs every 5 seconds until the browser tab is closed.
- Any authenticated user with an assessor token can view or export any other organization's candidate portfolios by changing the ID in the URL.

### Assumptions (Reasonable operational premises adopted for this case study)
- The target deployment environment expects multi-tenant SaaS operations where each customer organization operates within their assigned `tenant_id`.
- The ideal workflow requires Fit/Gap comparison reports to be generated reliably within 10 seconds, with graceful fallback if Gemini Flash narrative generation encounters rate limits or errors.
- The 4-day delivery timeframe requires a focused, high-impact vertical slice rather than wide architectural churn.
