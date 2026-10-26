import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function levelLabel(level: number | null | undefined): string {
  if (level == null) return "Not assessed";
  return LEVEL_LABELS[level] ?? "Invalid level";
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? "Needs review";
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? FIT_GAP_RESULT_CLASSES.not_assessed;

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✓";
  else if (comparison.result === "exceed") { icon = "★"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` −${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>{icon} {label}{suffix}</span>;
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  if (comparisons.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      No skill requirements are available for comparison. Add role requirements before interpreting fit.
    </p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Skill comparison summary">
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Match</p><p className="text-xl font-semibold">{matchCount}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Above requirement</p><p className="text-xl font-semibold">{exceedCount}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Gap</p><p className="text-xl font-semibold">{gapCount}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Not assessed</p><p className="text-xl font-semibold">{notAssessedCount}</p></div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th scope="col" className="text-left px-4 py-2.5 font-medium">Skill</th>
            <th scope="col" className="text-center px-4 py-2.5 font-medium">Required</th>
            <th scope="col" className="text-center px-4 py-2.5 font-medium">Candidate</th>
            <th scope="col" className="text-center px-4 py-2.5 font-medium">Result</th>
          </tr></thead>
          <tbody>{comparisons.map((comparison) => (
            <tr key={comparison.skill_id ?? comparison.skill_label} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{comparison.skill_label}</td>
              <td className="px-4 py-2.5 text-center text-muted-foreground">{levelLabel(comparison.required_level)}</td>
              <td className="px-4 py-2.5 text-center">
                {comparison.candidate_level != null ? <span>
                  {levelLabel(comparison.candidate_level)}
                  {comparison.is_override && <span className="text-xs text-muted-foreground ml-1" title="Assessor override applied">✎ human-reviewed</span>}
                </span> : <span className="text-muted-foreground">Not assessed</span>}
              </td>
              <td className="px-4 py-2.5 text-center"><ResultBadge comparison={comparison} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Comparison is evidence support, not an automated hiring decision. “Not assessed” means the available portfolio does not support a level yet.
      </p>
    </div>
  );
}
