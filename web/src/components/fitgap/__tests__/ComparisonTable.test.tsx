import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "../ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  it("renders empty state message when comparisons list is empty", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/no skill comparison data available/i)).toBeInTheDocument();
  });

  it("renders table with skill comparisons, required levels, and result badges", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_id: 1,
        skill_label: "Ruby on Rails",
        required_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
        is_override: false,
      },
      {
        skill_id: 2,
        skill_label: "System Design",
        required_level: 4,
        candidate_level: 2,
        result: "gap",
        delta: -2,
        is_override: false,
      },
      {
        skill_id: 3,
        skill_label: "PostgreSQL",
        required_level: 2,
        candidate_level: 4,
        result: "exceed",
        delta: 2,
        is_override: true,
        assessor_notes: "Candidate demonstrated deep query optimization skills",
      },
      {
        skill_id: 4,
        skill_label: "Docker",
        required_level: 3,
        result: "not_assessed",
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    // Check skills rendered
    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();

    // Check notes and override indicator
    expect(screen.getByText(/demonstrated deep query optimization/i)).toBeInTheDocument();
    expect(screen.getByText(/✏️ Human/i)).toBeInTheDocument();

    // Check summary badges at the bottom
    expect(screen.getByText(/Match: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Not Assessed: 1/)).toBeInTheDocument();
  });

  it("supports expected_level fallback when required_level is omitted", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_id: 5,
        skill_label: "Redis",
        expected_level: 2,
        candidate_level: 4,
        result: "exceed",
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
  });
});
