import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CandidatePDPNotice from "./CandidatePDPNotice";

afterEach(() => cleanup());

describe("CandidatePDPNotice", () => {
  it("renders the UU PDP disclosure and role information", () => {
    render(
      <CandidatePDPNotice
        consented={false}
        onConsentChange={vi.fn()}
        roleTitle="Senior Frontend Engineer"
        timeLimitMin={45}
      />
    );

    expect(screen.getByText(/Pelindungan Data Pribadi & Hak Kandidat \(UU PDP No\. 27\/2022\)/i)).toBeTruthy();
    expect(screen.getByText("Senior Frontend Engineer")).toBeTruthy();
    expect(screen.getByText(/durasi maksimal 45 menit/i)).toBeTruthy();
  });

  it("toggles the detailed candidate rights section when clicking the button", () => {
    render(
      <CandidatePDPNotice
        consented={false}
        onConsentChange={vi.fn()}
        roleTitle="Backend Engineer"
      />
    );

    const toggleButton = screen.getByRole("button", { name: /Pelajari hak Anda/i });
    expect(screen.queryByText(/Pengawasan Manusia \(Human-in-the-Loop\)/i)).toBeNull();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/Pengawasan Manusia \(Human-in-the-Loop\)/i)).toBeTruthy();
    expect(screen.getByText(/Data Terenkripsi & Terisolasi/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Tutup rincian/i }));
    expect(screen.queryByText(/Pengawasan Manusia \(Human-in-the-Loop\)/i)).toBeNull();
  });

  it("calls onConsentChange when the checkbox is toggled", () => {
    const handleConsent = vi.fn();
    render(
      <CandidatePDPNotice
        consented={false}
        onConsentChange={handleConsent}
      />
    );

    const checkbox = screen.getByLabelText(/memberikan persetujuan eksplisit/i);
    fireEvent.click(checkbox);

    expect(handleConsent).toHaveBeenCalledWith(true);
  });
});
