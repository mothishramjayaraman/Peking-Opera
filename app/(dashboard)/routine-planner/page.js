"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Target,
  Sparkles,
  CheckCircle2,
  Circle,
  Play,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/query-client.js";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizeExercise } from "@/lib/exercise-locale.js";

export default function RoutinePlanner() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [goalMinutes, setGoalMinutes] = useState(30);
  const [focusAreas, setFocusAreas] = useState([]);

  const { data: routines, isLoading } = useQuery({
    queryKey: ["/api/practice-routines"],
  });

  const generateRoutineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/practice-routine/generate", {
        goalMinutes,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice-routines"] });
    },
  });

  const handleFocusAreaToggle = (area) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleStartRoutine = (routine) => {
    if (routine.exercises.length > 0) {
      const firstExercise = routine.exercises[0];
      router.push(`/practice?exerciseId=${firstExercise.id}&from=routine&routineId=${routine.id}`);
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "warmup":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "technique":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      case "performance":
        return "bg-pink-500/10 text-pink-700 dark:text-pink-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "hard":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const focusAreaKeys = ["warmup", "technique", "performance"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{t.routine.title}</h1>
          <p className="text-muted-foreground">
            {t.routine.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t.routine.generateTitle}
            </CardTitle>
            <CardDescription>
              {t.routine.generateDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t.routine.duration}
                </Label>
                <span className="text-sm font-medium">{goalMinutes} {t.minutes}</span>
              </div>
              <Slider
                value={[goalMinutes]}
                onValueChange={(value) => setGoalMinutes(value[0])}
                min={10}
                max={90}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {t.routine.durationTip}
              </p>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t.routine.focusAreas}
              </Label>
              <div className="space-y-2">
                {focusAreaKeys.map((area) => (
                  <div key={area} className="flex items-center space-x-2">
                    <Checkbox
                      id={area}
                      checked={focusAreas.includes(area)}
                      onCheckedChange={() => handleFocusAreaToggle(area)}
                    />
                    <label
                      htmlFor={area}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t.routine.categories[area]}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.routine.focusAreasTip}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => generateRoutineMutation.mutate()}
              disabled={generateRoutineMutation.isPending}
            >
              {generateRoutineMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.routine.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t.routine.generate}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed text-justify">
              <strong className="text-foreground">Note:</strong> The system balances your routine across different focus areas. If a specific area runs out of exercises, it will automatically fill any remaining time with bonus exercises to ensure you get a full practice session!
            </p>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">{t.routine.yourRoutines}</h2>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : routines && routines.length > 0 ? (
            <div className="space-y-4">
              {routines.map((routine) => {
                const progress = routine.totalExercises > 0
                  ? (routine.completedExercises / routine.totalExercises) * 100
                  : 0;
                
                const actualDuration = routine.exercises.reduce((acc, ex) => acc + ex.durationMinutes, 0);

                return (
                  <Card key={routine.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {t.routine.minuteSession(actualDuration > 0 ? actualDuration : routine.goalMinutes)}
                          </CardTitle>
                          <CardDescription>
                            {t.routine.exercisesCount(routine.totalExercises, routine.completedExercises)}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleStartRoutine(routine)}
                          disabled={routine.exercises.length === 0}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {t.routine.start}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.routine.progress}</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {routine.exercises.map((exercise, index) => {
                          const isCompleted = index < routine.completedExercises;

                          return (
                            <div
                              key={exercise.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">
                                    {localizeExercise(exercise, lang).name}
                                  </p>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getCategoryColor(exercise.category)}`}
                                  >
                                    {t.routine.categories[exercise.category] || exercise.category}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getDifficultyColor(exercise.difficulty)}`}
                                  >
                                    {t.exerciseCard.difficulty[exercise.difficulty] || exercise.difficulty}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {localizeExercise(exercise, lang).description}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground shrink-0">
                                {exercise.durationMinutes} {t.minutes}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t.routine.noRoutines}</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  {t.routine.noRoutinesDesc}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
