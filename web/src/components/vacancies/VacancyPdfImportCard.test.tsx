import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VacancyPdfImportCard from "./VacancyPdfImportCard";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({ vacanciesApi: { importPdf: vi.fn() } }));

describe("VacancyPdfImportCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("imports a PDF and returns the vacancy for review", async () => {
    const vacancy = { id: 42, role_title: "Senior Engineer", skills: [] };
    vi.mocked(vacanciesApi.importPdf).mockResolvedValue({ data: { vacancy } } as never);
    const onImported = vi.fn();
    render(<VacancyPdfImportCard onImported={onImported} />);
    const file = new File(["%PDF-1.4"], "job-description.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/file job description/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import dan lanjutkan/i }));
    await waitFor(() => expect(vacanciesApi.importPdf).toHaveBeenCalledWith(file));
    expect(onImported).toHaveBeenCalledWith(vacancy);
  });

  it("rejects non-PDF files before calling the API", async () => {
    render(<VacancyPdfImportCard onImported={vi.fn()} />);
    const file = new File(["not pdf"], "job-description.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/file job description/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import dan lanjutkan/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("File harus berupa PDF.");
    expect(vacanciesApi.importPdf).not.toHaveBeenCalled();
  });
});
