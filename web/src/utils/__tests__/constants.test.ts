import { describe, it, expect } from "vitest";
import {
  parseLevel,
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
} from "../constants";

describe("parseLevel", () => {
  it("passes through numeric levels", () => {
    expect(parseLevel(1)).toBe(1);
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(5)).toBe(5);
  });

  it("extracts numbers from string format like 'L3'", () => {
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L5")).toBe(5);
    expect(parseLevel("level 4")).toBe(4);
  });

  it("falls back to 1 for unparseable strings", () => {
    expect(parseLevel("")).toBe(1);
    expect(parseLevel("invalid")).toBe(1);
  });
});

describe("LEVEL_LABELS and DESCRIPTIONS", () => {
  it("provides correct level code and human descriptions L1-L5", () => {
    expect(LEVEL_LABELS[1]).toBe("L1");
    expect(LEVEL_LABELS[5]).toBe("L5");
    expect(LEVEL_DESCRIPTIONS[1]).toBe("Foundational");
    expect(LEVEL_DESCRIPTIONS[3]).toBe("Proficient");
    expect(LEVEL_DESCRIPTIONS[5]).toBe("Expert");
  });
});

describe("FIT_GAP_RESULT_LABELS and CLASSES", () => {
  it("contains display labels for all fit/gap outcomes", () => {
    expect(FIT_GAP_RESULT_LABELS.match).toBe("Match");
    expect(FIT_GAP_RESULT_LABELS.gap).toBe("Gap");
    expect(FIT_GAP_RESULT_LABELS.exceed).toBe("Exceeds");
    expect(FIT_GAP_RESULT_LABELS.not_assessed).toBe("Not assessed");
  });

  it("contains CSS classes for badges", () => {
    expect(FIT_GAP_RESULT_CLASSES.match).toContain("text-green-700");
    expect(FIT_GAP_RESULT_CLASSES.gap).toContain("text-amber-700");
  });
});

describe("COVERAGE_STATE progression", () => {
  it("maps coverage states to progress percentages", () => {
    expect(COVERAGE_STATE_WIDTH.not_yet).toBe(0);
    expect(COVERAGE_STATE_WIDTH.initiated).toBe(25);
    expect(COVERAGE_STATE_WIDTH.partial).toBe(60);
    expect(COVERAGE_STATE_WIDTH.covered).toBe(100);
  });
});
