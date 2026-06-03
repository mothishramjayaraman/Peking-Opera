"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Target, Sparkles, Star, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseCard } from "@/components/exercise-card.jsx";
import { phases } from "../../../../shared/constants.js";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizePhase } from "@/lib/exercise-locale.js";

export default function Phase() {
  const params = useParams();
  const router = useRouter();
  console.log("[DEBUG] Phase Page: params=", params);
  const phaseId = parseInt(params.id || "1");
  const { t, lang } = useLanguage();

  const phase = localizePhase(phases.find((p) => p.id === phaseId), lang);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/phase", phaseId],
  });

  const phaseIcons = {
    1: Target,
    2: Sparkles,
    3: Star,
  };

  const PhaseIcon = phaseIcons[phaseId] || Target;

  if (isLoading) {
    return <PhaseSkeleton />;
  }

  if (!data || !phase || data.user.currentPhase < phaseId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <Lock className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">{t.phase.notAvailable}</h2>
        <p className="text-muted-foreground mb-4">
          {t.phase.notAvailableDesc}
        </p>
        <Button onClick={() => router.push("/dashboard")}>{t.phase.backToDashboard}</Button>
      </div>
    );
  }

  const { user, exercises, completedIds, phaseProgress, phaseTestSong } = data;
  const isUnlocked = user.currentPhase >= phaseId;

  const completedCount = exercises.filter((e) => completedIds.includes(e.id)).length;
  const isPhaseComplete = phaseProgress >= 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <PhaseIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t.phase.pageTitle(phaseId, phase.name)}</h1>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground">{phase.description}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-2xl font-bold">{Math.round(phaseProgress)}%</p>
                <p className="text-sm text-muted-foreground">{t.phase.complete}</p>
              </div>
              <Progress value={phaseProgress} className="w-32 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isPhaseComplete && phaseTestSong && (
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary fill-primary" />
                    {t.phase.finalTest(phaseId)}
                  </CardTitle>
                  <Badge variant="default" className="bg-primary hover:bg-primary/90">{t.phase.availableNow}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{phaseTestSong.title}</h3>
                    <p className="text-muted-foreground">{phaseTestSong.artist}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  {t.phase.finalTestDesc}
                </p>
                <Button
                  className="w-full h-12 text-lg font-semibold"
                  onClick={() => router.push(`/perform?songId=${phaseTestSong.id}&isTest=true&phase=${phaseId}`)}
                >
                  {t.phase.startTest}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t.phase.exercises}</h2>
              <Badge variant="secondary">
                {t.phase.exercisesCompleted(completedCount, exercises.length)}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  isCompleted={completedIds.includes(exercise.id)}
                  onStart={() => router.push(`/practice?exerciseId=${exercise.id}&phase=${phaseId}`)}
                />
              ))}
            </div>

            {exercises.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {t.phase.noExercises}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t.phase.whatYoullLearn}</h2>
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {phase.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                      {idx + 1}
                    </span>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {phaseId < 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.phase.nextPhase}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {user.currentPhase > phaseId ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(`/phase/${phaseId + 1}`)}
                    >
                      {t.phase.goToPhase(phaseId + 1)}
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <Lock className="h-4 w-4 inline mr-2" />
                      {localizePhase(phases[phaseId], lang)?.unlockCriteria}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-9 h-9 rounded-md" />
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
          </div>
        </div>
      </div>

      <Skeleton className="h-24 rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
