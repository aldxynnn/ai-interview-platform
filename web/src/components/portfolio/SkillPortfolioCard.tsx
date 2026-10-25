import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({ skill, override, onOverrideSaved }: SkillPortfolioCardProps) {
  const hasEvidence = skill.evidence.length > 0;
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            {hasEvidence ? <LevelBadge level={effectiveLevel} /> : (
              <span className="inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium text-muted-foreground">Not assessed</span>
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && <span className="flex items-center gap-1 text-xs text-amber-700"><Zap aria-hidden="true" className="h-3 w-3" /> Discovered</span>}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          {hasEvidence ? (
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          ) : (
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">
              No direct candidate quote was returned. This skill is excluded from fit/gap scoring until evidence is available.
            </p>
          )}
        </div>

        {hasEvidence && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Evidence is limited. Review the transcript before relying on this rating.
          </div>
        )}

        {hasEvidence ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence from interview</span>
            <ul className="space-y-2">
              {skill.evidence.map((quote, index) => (
                <li key={index} className="break-words border-l-2 border-muted pl-3 text-sm leading-6">“{quote}”</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No candidate evidence is available for this skill. Do not interpret the generated level as an assessment result.
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Competency summary</span>
            <p className="break-words text-sm leading-relaxed text-muted-foreground">{skill.competency_summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
