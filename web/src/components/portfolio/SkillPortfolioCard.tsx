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
  onOverrideRemoved?: () => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  onOverrideRemoved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onSaved={onOverrideSaved}
            onRemoved={onOverrideRemoved}
          />
        </div>

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
            <span>ℹ️</span>
            <span>Only briefly explored. Confidence is low — warrants a dedicated session if this skill is critical for the role.</span>
          </div>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Evidence from interview
            </span>
            <ul className="space-y-1 text-sm text-foreground/90">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="italic text-xs sm:text-sm pl-2 border-l-2 border-primary/40">
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
