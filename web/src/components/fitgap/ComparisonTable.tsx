import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps { comparisons: SkillComparison[]; }

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? "Unknown";
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-600 bg-neutral-100";
  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";
  return <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>{icon} {label}{suffix}</span>;
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matches = comparisons.filter((c) => c.result === "match").length;
  const gaps = comparisons.filter((c) => c.result === "gap").length;
  const exceeds = comparisons.filter((c) => c.result === "exceed").length;
  const unassessed = comparisons.filter((c) => c.result === "not_assessed").length;

  if (comparisons.length === 0) return <div role="status" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada skill persyaratan yang dapat dibandingkan untuk vacancy ini.</div>;

  return <div className="space-y-3">
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th scope="col" className="text-left px-4 py-2.5 font-medium">Skill</th>
          <th scope="col" className="text-center px-4 py-2.5 font-medium">Required</th>
          <th scope="col" className="text-center px-4 py-2.5 font-medium">Candidate</th>
          <th scope="col" className="text-center px-4 py-2.5 font-medium">Result</th>
        </tr></thead>
        <tbody>{comparisons.map((c) => <tr key={`${c.skill_id ?? "custom"}-${c.skill_label}`} className="border-b last:border-0">
          <td className="px-4 py-2.5 break-words">{c.skill_label}</td>
          <td className="px-4 py-2.5 text-center text-muted-foreground">{c.required_level != null ? (LEVEL_LABELS[c.required_level] ?? "—") : "—"}</td>
          <td className="px-4 py-2.5 text-center">{c.candidate_level != null ? <span>{LEVEL_LABELS[c.candidate_level] ?? "—"}{c.is_override && <span className="text-xs text-muted-foreground ml-1" title="Assessor override applied">✏</span>}</span> : <span className="text-muted-foreground">—</span>}</td>
          <td className="px-4 py-2.5 text-center"><ResultBadge comparison={c} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-live="polite">
      {matches > 0 && <span>✅ Match: {matches} skill{matches !== 1 ? "s" : ""}</span>}
      {gaps > 0 && <span>⚠ Gap: {gaps} skill{gaps !== 1 ? "s" : ""}</span>}
      {exceeds > 0 && <span>⭐ Exceeds: {exceeds} skill{exceeds !== 1 ? "s" : ""}</span>}
      {unassessed > 0 && <span>— Not assessed: {unassessed} skill{unassessed !== 1 ? "s" : ""}</span>}
      <span className="sm:ml-auto">✏ = human override applied</span>
    </div>
  </div>;
}
