"use client";

import { ProgressRing } from "./progress-ring.jsx";

export function ScoreDisplay({
  pitchScore,
  toneScore,
  breathingScore,
  vibratoScore,
  expressionScore,
  ornamentScore,
  overallScore,
  highlightedMetrics = null,
  visibleMetrics = null,
  className = "",
}) {
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const focusMetrics = highlightedMetrics ?? visibleMetrics;

  const allMetrics = [
    { id: "pitch", label: "Pitch", score: pitchScore },
    { id: "tone", label: "Tone", score: toneScore },
    { id: "breathing", label: "Breathing", score: breathingScore },
    { id: "vibrato", label: "Vibrato", score: vibratoScore },
    { id: "expression", label: "Expression", score: expressionScore },
    { id: "ornamentation", label: "Ornamentation", score: ornamentScore },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-center">
        <div className="text-center">
          <ProgressRing
            progress={overallScore}
            size={120}
            strokeWidth={10}
            showLabel={false}
          />
          <div className="mt-2">
            <span className={`text-4xl font-bold ${getScoreColor(overallScore || 0)}`}>
              {Math.round(overallScore || 0)}
            </span>
            <span className="text-muted-foreground text-lg">/100</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
        </div>
      </div>

      {focusMetrics && focusMetrics.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            ★ Focus
          </span>
          {" "}metrics are highlighted for this exercise
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {allMetrics.map(({ id, label, score }) => {
          const isFocus = focusMetrics ? focusMetrics.includes(id) : false;
          return (
            <div
              key={id}
              className={`relative text-center rounded-xl p-3 transition-all ${
                isFocus
                  ? "ring-2 ring-primary/60 bg-primary/5 shadow-[0_0_12px_2px_hsl(var(--primary)/0.18)]"
                  : "opacity-70"
              }`}
            >
              {isFocus && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest text-primary bg-background px-1.5 py-0.5 rounded-full border border-primary/30">
                  Focus
                </span>
              )}
              <ProgressRing
                progress={score || 0}
                size={64}
                strokeWidth={6}
                showLabel={false}
                strokeColor={isFocus ? "hsl(var(--primary))" : undefined}
              />
              <p className={`mt-2 text-2xl font-semibold ${isFocus ? getScoreColor(score || 0) : "text-muted-foreground"}`}>
                {Math.round(score || 0)}
              </p>
              <p className={`text-xs ${isFocus ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
