import api from "./api";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";

export const portfoliosApi = {
  // Alias saveOverride for clarity; keep getOverride for backward compatibility
  saveOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  deleteOverride: (portfolioSkillId: number) =>
    api.delete<{ message: string; portfolio_skill_id: number; ai_level: number }>(
      `/portfolio_skills/${portfolioSkillId}/override`
    ),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId },
    }),

  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get<{ report: FitGapReport }>(`/portfolios/${portfolioId}/fitgap/${vacancyId}`),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
    }),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};
