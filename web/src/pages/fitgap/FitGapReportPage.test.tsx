import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
  },
}));

vi.mock("@/components/fitgap/ComparisonTable", () => ({
  default: ({ comparisons }: { comparisons: unknown[] }) => (
    <div data-testid="comparison-table">{comparisons.length} comparisons</div>
  ),
}));

const previousReport = {
  id: 21,
  portfolio_id: 10,
  vacancy_id: 7,
  skill_comparisons: [],
  culture_narrative: "Human review context",
  overall_narrative: "Structured results are advisory.",
  generated_at: "2026-10-25T10:00:00Z",
  generation_status: "failed" as const,
  generation_error: "Refresh failed. Previous report retained.",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/7"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FitGapReportPage failure states", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: { id: 10, skills: [], generation_status: "complete" } },
    } as never);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: previousReport } } as never);
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue({ data: { status: "generating" } } as never);
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { status: "generating" } } as never);
  });

  it("shows the previous report and offers retry when regeneration failed", async () => {
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh failed. Previous report retained.");
    expect(screen.getByText("Human review context")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(10, 7));
    expect(screen.getByText("Human review context")).toBeInTheDocument();
  });

  it("shows a recoverable error when report loading fails", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue({ response: { status: 503 } });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not load this report. Check your connection and retry.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
