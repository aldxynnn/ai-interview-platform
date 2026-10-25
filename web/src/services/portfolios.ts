import api from "./api";
import type { Portfolio, AssessorOverride, FitGapReport, FitGapGenerationStatus } from "@/types";

export interface FitGapRequestResponse {
  status: FitGapGenerationStatus;
  report: FitGapReport;
  message?: string;
}

export const portfoliosApi = {
  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>("/portfolio_skills/" + portfolioSkillId + "/override", {
      override: data,
    }),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<FitGapRequestResponse | { report: FitGapReport }>("/portfolios/" + portfolioId + "/fitgap", {
      fitgap: { vacancy_id: vacancyId },
    }),

  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get<{ report: FitGapReport }>("/portfolios/" + portfolioId + "/fitgap/" + vacancyId),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<FitGapRequestResponse>("/portfolios/" + portfolioId + "/regenerate_fitgap", {
      vacancy_id: vacancyId,
    }),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get("/portfolios/" + portfolioId + "/export", {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};
