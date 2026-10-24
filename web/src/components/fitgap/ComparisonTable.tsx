import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? "Needs review";
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-600 bg-neutral-100";
  const delta = comparison.delta;
  const suffix =
    comparison.result === "exceed" && typeof delta === "number" && delta > 0
      ? ` +${delta}`
      : comparison.result === "gap" && typeof delta === "number" && delta < 0
        ? ` -${Math.abs(delta)}`
        : "";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", classes)}>
      <span aria-hidden="true">
        {comparison.result === "match" ? "✓" : comparison.result === "exceed" ? "↑" : comparison.result === "gap" ? "↓" : "—"}
      </span>
      {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  if (comparisons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No skill comparisons yet</p>
        <p className="mt-1 text-sm text-muted-foreground">This report does not contain comparison rows. Retry generation or review the vacancy requirements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-left font-medium">Skill</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">Required</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">Assessed</th>
                <th scope="col" className="px-4 py-3 text-center font-medium">Confidence</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comparison, index) => (
                <tr key={comparison.skill_id || `${comparison.skill_label}-${index}`} className="border-b last:border-0 transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{comparison.skill_label || "Unnamed skill"}</div>
                    {comparison.is_override && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                        <span aria-hidden="true">✎</span> Assessor-adjusted
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{LEVEL_LABELS[comparison.expected_level] ?? "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {comparison.candidate_level != null ? LEVEL_LABELS[comparison.candidate_level] ?? "—" : <span className="text-muted-foreground">Not assessed</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {comparison.confidence ? (
                      <span className={cn(
                        "rounded-md px-2 py-1 text-xs capitalize",
                        comparison.confidence === "high" ? "bg-emerald-50 text-emerald-700" :
                        comparison.confidence === "medium" ? "bg-amber-50 text-amber-800" :
                        "bg-neutral-100 text-neutral-600"
                      )}>{comparison.confidence}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><ResultBadge comparison={comparison} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{matchCount}</strong> match</span>
        <span><strong className="text-foreground">{gapCount}</strong> gap</span>
        <span><strong className="text-foreground">{exceedCount}</strong> above requirement</span>
        <span><strong className="text-foreground">{notAssessedCount}</strong> not assessed</span>
        <span className="ml-auto">Human review remains required.</span>
      </div>
    </div>
  );
}
