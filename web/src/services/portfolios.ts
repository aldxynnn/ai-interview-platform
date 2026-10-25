import api from "./api";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";

/** Shape returned by GET /portfolios/:id/fitgap/:vacancy_id when report is not yet ready */
export interface FitGapPendingResponse {
  status: "not_started" | "generating";
}

export interface FitGapReadyResponse {
  report: FitGapReport;
}

export const portfoliosApi = {
  getOverride: (
    portfolioSkillId: number,
    data: { override_level: number; assessor_notes: string }
  ) =>
    api.post<{ override: AssessorOverride }>(
      `/portfolio_skills/${portfolioSkillId}/override`,
      { override: data }
    ),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<FitGapReadyResponse | { status: string; message: string }>(
      `/portfolios/${portfolioId}/fitgap`,
      { fitgap: { vacancy_id: vacancyId } }
    ),

  /**
   * Returns the report when ready, or { status: "not_started" | "generating" }
   * when the report is not yet available.
   * Never throws 404 — backend returns 200 with a status payload instead.
   */
  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get<FitGapReadyResponse | FitGapPendingResponse>(
      `/portfolios/${portfolioId}/fitgap/${vacancyId}`
    ),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(
      `/portfolios/${portfolioId}/regenerate_fitgap`,
      { vacancy_id: vacancyId }
    ),

  exportPortfolio: (
    portfolioId: number,
    format: "pdf" | "json",
    vacancyId?: number
  ) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};
