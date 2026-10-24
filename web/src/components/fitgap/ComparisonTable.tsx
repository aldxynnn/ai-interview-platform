import { useState, useMemo } from "react";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import LevelBadge from "@/components/portfolio/LevelBadge";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";
import {
  CheckCircle2,
  Star,
  AlertTriangle,
  HelpCircle,
  Edit3,
  MessageSquare,
  Filter,
  ArrowRight,
  Info,
} from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

type FilterTab = "all" | "fit" | "gap" | "override" | "unassessed";

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = comparison.result;
  const delta = comparison.delta;

  if (result === "match") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        Match
      </span>
    );
  }

  if (result === "exceed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
        <Star className="h-3.5 w-3.5 text-teal-600 fill-teal-100" />
        Exceeds {delta ? `(+${delta})` : ""}
      </span>
    );
  }

  if (result === "gap") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
        Gap {delta ? `(${delta})` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
      Not assessed
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Summary counts
  const matchCount = useMemo(() => comparisons.filter((c) => c.result === "match").length, [comparisons]);
  const exceedCount = useMemo(() => comparisons.filter((c) => c.result === "exceed").length, [comparisons]);
  const gapCount = useMemo(() => comparisons.filter((c) => c.result === "gap").length, [comparisons]);
  const overrideCount = useMemo(() => comparisons.filter((c) => Boolean(c.is_override)).length, [comparisons]);
  const unassessedCount = useMemo(() => comparisons.filter((c) => c.result === "not_assessed").length, [comparisons]);

  const filteredComparisons = useMemo(() => {
    switch (activeTab) {
      case "fit":
        return comparisons.filter((c) => c.result === "match" || c.result === "exceed");
      case "gap":
        return comparisons.filter((c) => c.result === "gap");
      case "override":
        return comparisons.filter((c) => Boolean(c.is_override));
      case "unassessed":
        return comparisons.filter((c) => c.result === "not_assessed");
      default:
        return comparisons;
    }
  }, [comparisons, activeTab]);

  return (
    <div className="space-y-4">
      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All Skills ({comparisons.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fit")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
              activeTab === "fit"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
            )}
          >
            <CheckCircle2 className="h-3 w-3" /> Fit ({matchCount + exceedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gap")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
              activeTab === "gap"
                ? "bg-rose-700 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
            )}
          >
            <AlertTriangle className="h-3 w-3" /> Gaps ({gapCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("override")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
              activeTab === "override"
                ? "bg-amber-700 text-white shadow-xs"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
            )}
          >
            <Edit3 className="h-3 w-3" /> Overrides ({overrideCount})
          </button>
          {unassessedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("unassessed")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
                activeTab === "unassessed"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              )}
            >
              <HelpCircle className="h-3 w-3" /> Unassessed ({unassessedCount})
            </button>
          )}
        </div>

        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Showing {filteredComparisons.length} of {comparisons.length} skills</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-xs" role="region" aria-label="Skill Comparisons Table" tabIndex={0}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
              <th scope="col" className="text-left px-4 py-3 min-w-[200px]">Vacancy Competency</th>
              <th scope="col" className="text-center px-4 py-3 min-w-[120px]">Required Level</th>
              <th scope="col" className="text-center px-4 py-3 min-w-[130px]">AI Assessed</th>
              <th scope="col" className="text-center px-4 py-3 min-w-[140px]">Calibrated (Final)</th>
              <th scope="col" className="text-center px-4 py-3 min-w-[120px]">Fit Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredComparisons.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter className="h-6 w-6 text-muted-foreground/60" />
                    <p>No skills match the selected tab filter.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("all")}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Reset filter to show all skills
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredComparisons.map((c, i) => {
                const reqLevel = c.required_level ?? c.expected_level;
                const candidateLevel = c.candidate_level;
                const isOverridden = Boolean(c.is_override);
                const aiLevel = c.ai_level ?? candidateLevel;

                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    {/* Skill Name & Assessor Notes */}
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-foreground">{c.skill_label}</div>

                      {/* Assessor Note Callout */}
                      {c.assessor_notes && (
                        <div className="mt-2 rounded-md bg-amber-50/80 border border-amber-200/80 p-2 text-xs text-amber-950 flex items-start gap-1.5 shadow-2xs">
                          <MessageSquare className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-amber-900 flex items-center gap-1">
                              Assessor Calibration Note
                            </span>
                            <p className="text-amber-900/90 italic">"{c.assessor_notes}"</p>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Required Level */}
                    <td className="px-4 py-3 text-center align-top">
                      {reqLevel != null && reqLevel >= 1 && reqLevel <= 5 ? (
                        <div className="inline-flex flex-col items-center">
                          <LevelBadge level={reqLevel} size="sm" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* AI Assessed Level & Confidence */}
                    <td className="px-4 py-3 text-center align-top">
                      {candidateLevel != null ? (
                        <div className="inline-flex flex-col items-center gap-1">
                          {aiLevel != null && aiLevel >= 1 && aiLevel <= 5 ? (
                            <span
                              className={cn(
                                "font-medium text-xs px-2 py-0.5 rounded border",
                                isOverridden
                                  ? "line-through text-muted-foreground bg-muted/40 border-muted"
                                  : "text-foreground bg-secondary/60 border-border"
                              )}
                            >
                              {LEVEL_LABELS[aiLevel]} ({LEVEL_DESCRIPTIONS[aiLevel]})
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}

                          {c.confidence && (
                            <div className="scale-90 origin-top">
                              <ConfidenceIndicator confidence={c.confidence} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Not explored</span>
                      )}
                    </td>

                    {/* Calibrated / Final Level */}
                    <td className="px-4 py-3 text-center align-top">
                      {candidateLevel != null && candidateLevel >= 1 && candidateLevel <= 5 ? (
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <LevelBadge level={candidateLevel} size="sm" />
                          {isOverridden && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                              title={c.ai_level ? `Calibrated from AI L${c.ai_level} to L${candidateLevel}` : "Calibrated by Assessor"}
                            >
                              <Edit3 className="h-2.5 w-2.5 text-amber-700" />
                              Calibrated
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Fit Result Badge */}
                    <td className="px-4 py-3 text-center align-top">
                      <ResultBadge comparison={c} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend & Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/20 rounded-md p-2.5 border">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Match: Meets vacancy benchmark
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <span className="h-2 w-2 rounded-full bg-teal-500" /> Exceeds: Above target level
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Gap: Requires development
          </span>
        </div>
        <div className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <Edit3 className="h-3 w-3 text-amber-600" />
          <span>Calibrated = Verified by human assessor</span>
        </div>
      </div>
    </div>
  );
}
