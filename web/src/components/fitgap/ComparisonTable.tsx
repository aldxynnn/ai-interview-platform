import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { AlertTriangle, CheckCircle2, Star, MinusCircle } from "lucide-react";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "text-neutral-600 bg-neutral-100";

  let icon = <MinusCircle className="h-3 w-3 shrink-0" />;
  let suffix = "";

  if (comparison.result === "match") {
    icon = <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />;
  } else if (comparison.result === "exceed") {
    icon = <Star className="h-3 w-3 text-emerald-600 shrink-0" />;
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />;
    suffix = comparison.delta ? ` ${comparison.delta}` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border",
        classes
      )}
    >
      {icon}
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-4">
      {/* Metric summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-lg border bg-green-50/50 border-green-200/60 text-green-900 flex items-center justify-between">
          <span className="font-medium">Sesuai (Match)</span>
          <span className="font-semibold text-sm">{matchCount}</span>
        </div>
        <div className="p-2.5 rounded-lg border bg-emerald-50/50 border-emerald-200/60 text-emerald-900 flex items-center justify-between">
          <span className="font-medium">Melebihi (Exceed)</span>
          <span className="font-semibold text-sm">{exceedCount}</span>
        </div>
        <div className="p-2.5 rounded-lg border bg-amber-50/50 border-amber-200/60 text-amber-900 flex items-center justify-between">
          <span className="font-medium">Kesenjangan (Gap)</span>
          <span className="font-semibold text-sm">{gapCount}</span>
        </div>
        <div className="p-2.5 rounded-lg border bg-neutral-50 border-neutral-200 text-neutral-800 flex items-center justify-between">
          <span className="font-medium">Belum Dinilai</span>
          <span className="font-semibold text-sm">{notAssessedCount}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80 shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3">Kompetensi (Skill)</th>
              <th className="text-center px-4 py-3">Target Lowongan</th>
              <th className="text-center px-4 py-3">Capaian Kandidat</th>
              <th className="text-center px-4 py-3">Hasil Evaluasi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparisons.map((c, i) => {
              const targetLevel = c.expected_level ?? c.required_level;
              const hasLowConfidence = c.confidence?.toLowerCase() === "low";

              return (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col">
                      <span>{c.skill_label}</span>
                      {hasLowConfidence && (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5 font-normal">
                          <AlertTriangle className="h-3 w-3 inline" /> Kepercayaan rendah (bukti tipis)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground font-mono">
                    {targetLevel != null ? LEVEL_LABELS[targetLevel] || `L${targetLevel}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <span className="font-semibold text-foreground">
                          {LEVEL_LABELS[c.candidate_level] || `L${c.candidate_level}`}
                        </span>
                        {c.is_override && (
                          <span
                            className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-sans px-1.5 py-0.2 rounded"
                            title="Telah dikalibrasi secara manual oleh asesor"
                          >
                            ✏ dikalibrasi
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
        <span>Kandidat dinilai berdasarkan bukti kutipan ucapan langsung dan tolok ukur B7.</span>
        <span className="font-mono text-[11px]">✏ = review &amp; koreksi manual oleh asesor</span>
      </div>
    </div>
  );
}
