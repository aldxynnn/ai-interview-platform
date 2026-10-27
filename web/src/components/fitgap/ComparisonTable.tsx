import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "bg-muted text-muted-foreground";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠️"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "⚪";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded shadow-sm", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        No skill comparison data available for this vacancy.
      </div>
    );
  }

  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3">Skill</th>
              <th className="text-center px-4 py-3">Required</th>
              <th className="text-center px-4 py-3">Candidate</th>
              <th className="text-center px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisons.map((c, i) => {
              const reqLevel = c.required_level ?? c.expected_level ?? 1;
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{c.skill_label}</div>
                    {c.assessor_notes && (
                      <div className="text-xs text-muted-foreground italic mt-0.5">
                        Note: {c.assessor_notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground font-mono text-xs">
                    {LEVEL_LABELS[reqLevel] ?? `L${reqLevel}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                        {c.is_override && (
                          <span
                            className="inline-block text-xs text-amber-600 font-sans px-1 py-0.2 rounded bg-amber-50 border border-amber-200"
                            title="Adjusted by human assessor override"
                          >
                            ✏️ Human
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Not assessed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        {matchCount > 0 && <span className="font-medium text-emerald-700">✅ Match: {matchCount}</span>}
        {gapCount > 0 && <span className="font-medium text-rose-700">⚠️ Gap: {gapCount}</span>}
        {exceedCount > 0 && <span className="font-medium text-blue-700">⭐ Exceeds: {exceedCount}</span>}
        {notAssessedCount > 0 && <span className="font-medium text-zinc-600">⚪ Not Assessed: {notAssessedCount}</span>}
        <span className="ml-auto text-muted-foreground italic">✏️ = Human override applied</span>
      </div>
    </div>
  );
}
