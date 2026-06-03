"use client";

import { Lock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProgressRing } from "./progress-ring.jsx";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizePhase } from "@/lib/exercise-locale.js";

export function PhaseCard({
  phase,
  isUnlocked,
  isCompleted,
  progress,
  onClick,
}) {
  const { lang, t } = useLanguage();
  const p = localizePhase(phase, lang);
  const pc = t.phaseCard;

  return (
    <Card
      className={`relative cursor-pointer transition-all hover-elevate ${
        !isUnlocked ? "opacity-60" : ""
      }`}
      onClick={isUnlocked ? onClick : undefined}
      data-testid={`card-phase-${phase.id}`}
    >
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
          <Lock className="h-12 w-12 text-muted-foreground/50" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <ProgressRing progress={progress} size={48} strokeWidth={4} />
          )}
          <div>
            <h3 className="font-bold text-xl">{pc.phaseLabel(phase.id)}</h3>
            <p className="text-sm font-medium text-primary">{p.name}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{p.description}</p>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {pc.features}
          </p>
          <ul className="space-y-1">
            {p.features.slice(0, 3).map((feature, idx) => (
              <li key={idx} className="text-sm flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                {feature}
              </li>
            ))}
            {p.features.length > 3 && (
              <li className="text-sm text-muted-foreground">
                {pc.more(p.features.length - 3)}
              </li>
            )}
          </ul>
        </div>

        {!isUnlocked && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <Lock className="h-3 w-3 inline mr-1" />
              {p.unlockCriteria}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
