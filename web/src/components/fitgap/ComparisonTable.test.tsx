import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  {
    skill_label: "JavaScript",
    skill_id: "skill_js",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    confidence: "high",
    is_override: false,
  },
  {
    skill_label: "TypeScript",
    skill_id: "skill_ts",
    expected_level: 4,
    candidate_level: 2,
    result: "gap",
    delta: -2,
    confidence: "medium",
    is_override: true,
  },
  {
    skill_label: "Ruby",
    skill_id: "skill_ruby",
    expected_level: 2,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
    is_override: false,
  },
  {
    skill_label: "Accessibility",
    skill_id: "skill_a11y",
    expected_level: 3,
    candidate_level: 4,
    result: "exceed",
    delta: 1,
    confidence: "low",
    is_override: false,
  },
];

describe("ComparisonTable", () => {
  it("shows required levels from the API contract and does not mislabel unassessed skills as gaps", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const javascriptRow = screen.getByRole("row", { name: /JavaScript/ });
    expect(within(javascriptRow).getByText("L3")).toBeInTheDocument();
    expect(within(javascriptRow).getByText("Match")).toBeInTheDocument();

    const rubyRow = screen.getByRole("row", { name: /Ruby/ });
    expect(within(rubyRow).getByText("L2")).toBeInTheDocument();
    expect(within(rubyRow).getByText("Not assessed")).toBeInTheDocument();
    expect(within(rubyRow).getByText("Not assessed")).not.toHaveClass("text-amber-700");
    expect(within(rubyRow).getByText("—")).toBeInTheDocument();
  });

  it("shows confidence and calls out assessor-adjusted values", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const typescriptRow = screen.getByRole("row", { name: /TypeScript/ });
    expect(within(typescriptRow).getByText("Assessor-adjusted")).toBeInTheDocument();
    expect(within(typescriptRow).getByText("medium")).toBeInTheDocument();
    expect(within(typescriptRow).getByText(/Gap/)).toBeInTheDocument();
  });

  it("shows the four outcome counts", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Human review remains required.")).toBeInTheDocument();
  });

  it("renders a purposeful empty state", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No skill comparisons yet")).toBeInTheDocument();
    expect(screen.getByText(/does not contain comparison rows/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
