import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "../SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard Component", () => {
  const baseSkill: PortfolioSkill = {
    id: 10,
    skill_id: 1,
    skill_label: "API Architecture",
    ai_level: 3,
    ai_confidence: "high",
    is_discovered: false,
    evidence: ["Designed RESTful microservices handling 10k req/sec"],
    competency_summary: "Strong grasp of stateless service contracts and rate limiting.",
  };

  it("renders skill label, evidence quotes, and competency summary", () => {
    const handleSaved = vi.fn();
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={handleSaved} />);

    expect(screen.getByText("API Architecture")).toBeInTheDocument();
    expect(screen.getByText(/Designed RESTful microservices/i)).toBeInTheDocument();
    expect(screen.getByText(/Strong grasp of stateless service contracts/i)).toBeInTheDocument();
  });

  it("displays discovered badge when is_discovered is true", () => {
    const discoveredSkill: PortfolioSkill = {
      ...baseSkill,
      is_discovered: true,
    };
    render(<SkillPortfolioCard skill={discoveredSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("shows low confidence warning when confidence is low", () => {
    const lowConfidenceSkill: PortfolioSkill = {
      ...baseSkill,
      ai_confidence: "low",
    };
    render(<SkillPortfolioCard skill={lowConfidenceSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText(/Only briefly explored. Confidence is low/i)).toBeInTheDocument();
  });
});
