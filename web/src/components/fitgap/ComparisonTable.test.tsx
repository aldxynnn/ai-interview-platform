import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const sampleComparisons: SkillComparison[] = [
    {
      skill_label: "React / Frontend Development Core",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      is_override: true,
    } as any,
    {
      skill_label: "Database Design & SQL",
      expected_level: 4,
      candidate_level: undefined,
      result: "not_assessed",
      delta: undefined,
      is_override: false,
    } as any,
  ];

  it("renders expected level L3 in the Required column and override indicator", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    // Verify skill labels
    expect(screen.getByText("React / Frontend Development Core")).toBeInTheDocument();
    expect(screen.getByText("Database Design & SQL")).toBeInTheDocument();

    // Verify required levels are rendered as L3 and L4 (NOT blank!)
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getAllByText("L4")).toHaveLength(2); // One required, one candidate

    // Verify candidate level L4 and override indicator
    expect(screen.getByText(/dikalibrasi/i)).toBeInTheDocument();
  });
});
