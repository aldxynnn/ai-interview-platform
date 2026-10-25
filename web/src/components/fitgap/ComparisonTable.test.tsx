import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

afterEach(() => cleanup());
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  { skill_id: "sk-react", skill_label: "React", required_level: 3, candidate_level: 4, result: "exceed", delta: 1, confidence: "high", is_override: true },
  { skill_id: "sk-ruby", skill_label: "Ruby", required_level: 4, candidate_level: 2, result: "gap", delta: -2, confidence: "medium", is_override: false },
  { skill_id: "sk-sql", skill_label: "SQL", required_level: 2, candidate_level: null, result: "not_assessed", delta: null, confidence: null, is_override: false },
];

describe("ComparisonTable", () => {
  it("renders the required level and assessor override from the API contract", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const reactRow = screen.getByRole("row", { name: /React/ });
    expect(within(reactRow).getByText("L3")).toBeTruthy();
    expect(within(reactRow).getByText("L4")).toBeTruthy();
    expect(within(reactRow).getByText("Assessor override applied")).toBeTruthy();
  });

  it("does not turn a missing rating into a gap", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const sqlRow = screen.getByRole("row", { name: /SQL/ });
    expect(within(sqlRow).getAllByText("Not assessed")).toHaveLength(2);
    expect(within(sqlRow).queryByText("Gap")).toBeNull();
    expect(within(sqlRow).getByText("L2")).toBeTruthy();
  });

  it("shows an explicit empty state", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText("No skill requirements to compare")).toBeTruthy();
    expect(screen.getByText(/Add skills to the vacancy/)).toBeTruthy();
  });
});
