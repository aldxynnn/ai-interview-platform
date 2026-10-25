import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
    regeneratePortfolio: vi.fn(),
  },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn() } }));

describe("PortfolioPage recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: { id: 3, session_id: 2, generation_status: "failed", generation_error: "Provider unavailable", skills: [], overrides: [] } },
    } as never);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as never);
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: { candidate_name: "Candidate" } } } as never);
    vi.mocked(sessionsApi.regeneratePortfolio).mockResolvedValue({
      data: { portfolio: { id: 3, session_id: 2, generation_status: "pending", skills: [], overrides: [] } },
    } as never);
  });

  it("shows one useful failure state and retries generation", async () => {
    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Provider unavailable");
    expect(screen.queryByText(/Portfolio generation failed/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /coba lagi/i }));
    await waitFor(() => expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledWith(2));
    expect(await screen.findByText(/Generating portfolio/i)).toBeInTheDocument();
  });
});
