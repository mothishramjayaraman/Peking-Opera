"use client";

import { Check, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizeExercise } from "@/lib/exercise-locale.js";

export function ExerciseCard({
  exercise,
  isCompleted = false,
  score,
  onStart,
}) {
  const { lang, t } = useLanguage();
  const ex = localizeExercise(exercise, lang);
  const ec = t.exerciseCard;

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "hard":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  return (
    <Card
      className={`transition-all ${isCompleted ? "opacity-75" : ""}`}
      data-testid={`card-exercise-${exercise.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate flex items-center gap-2">
              {isCompleted && (
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              )}
              {ex.name}
            </h3>
          </div>
          <Badge
            variant="secondary"
            className={`shrink-0 ${getDifficultyColor(exercise.difficulty)}`}
          >
            {ec.difficulty[exercise.difficulty] || exercise.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ex.description}
        </p>
        {score !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{ec.lastScore}:</span>
            <span className="font-semibold text-primary">{Math.round(score)}%</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-4 pt-0">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{exercise.durationMinutes} min</span>
        </div>
        <Button
          onClick={() => onStart(exercise)}
          size="sm"
          data-testid={`button-start-exercise-${exercise.id}`}
        >
          <PlayCircle className="h-4 w-4 mr-1" />
          {isCompleted ? ec.retry : ec.start}
        </Button>
      </CardFooter>
    </Card>
  );
}
