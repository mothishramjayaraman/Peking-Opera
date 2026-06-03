// weekly score, min spent, avg score
"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Flame,
  Target,
  Clock,
  TrendingUp,
  ChevronRight,
  Mic,
  Music,
  Star,
  Calendar,
  Map,
  Zap,
  Brain,
  Trophy,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/progress-ring.jsx";
import { PhaseCard } from "@/components/phase-card.jsx";
import { phases } from "../../../shared/constants.js";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizeExercise } from "@/lib/exercise-locale.js";
import { LanguageToggle } from "@/components/language-toggle.jsx";

export default function Dashboard() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, 
    staleTime: 5000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const { user, recentExercises, weeklyStats } = data;
  const weekProgress = Math.min((weeklyStats.practiceMinutes / weeklyStats.goalMinutes) * 100, 100);

  const learningPathConfig = {
    structured: {
      title: t.lp.paths.structured.name,
      description: t.lpc.structured.description,
      action: t.lpc.structured.action(user.currentPhase),
      actionUrl: "/phase/" + user.currentPhase,
      icon: Target,
      bgGradient: "bg-gradient-to-r from-blue-500/10 to-transparent",
      borderColor: "border-blue-500/20",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      titleColor: "text-blue-600 dark:text-blue-400",
    },
    intensive: {
      title: t.lp.paths.intensive.name,
      description: t.lpc.intensive.description,
      action: t.lpc.intensive.action,
      actionUrl: "/practice",
      icon: Zap,
      bgGradient: "bg-gradient-to-r from-orange-500/10 to-transparent",
      borderColor: "border-orange-500/20",
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-600 dark:text-orange-400",
      titleColor: "text-orange-600 dark:text-orange-400",
    },
    performance: {
      title: t.lp.paths.performance.name,
      description: t.lpc.performance.description,
      action: t.lpc.performance.action(user.currentPhase),
      actionUrl: user.currentPhase >= 2 ? "/songs" : "/practice",
      icon: Music,
      bgGradient: "bg-gradient-to-r from-purple-500/10 to-transparent",
      borderColor: "border-purple-500/20",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-600 dark:text-purple-400",
      titleColor: "text-purple-600 dark:text-purple-400",
    },
    adaptive: {
      title: t.lp.paths.adaptive.name,
      description: t.lpc.adaptive.description,
      action: t.lpc.adaptive.action,
      actionUrl: "/routine-planner",
      icon: Brain,
      bgGradient: "bg-gradient-to-r from-pink-500/10 to-transparent",
      borderColor: "border-pink-500/20",
      iconBg: "bg-pink-500/20",
      iconColor: "text-pink-600 dark:text-pink-400",
      titleColor: "text-pink-600 dark:text-pink-400",
    },
    flexible: {
      title: t.lp.paths.flexible.name,
      description: t.lpc.flexible.description,
      action: t.lpc.flexible.action,
      actionUrl: "/practice",
      icon: Sparkles,
      bgGradient: "bg-gradient-to-r from-green-500/10 to-transparent",
      borderColor: "border-green-500/20",
      iconBg: "bg-green-500/20",
      iconColor: "text-green-600 dark:text-green-400",
      titleColor: "text-green-600 dark:text-green-400",
    },
  };

  const currentPath = user.learningPath ? learningPathConfig[user.learningPath] : null;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-welcome">
            {t.welcomeBack}, {user.name}!
          </h1>
          <p className="text-muted-foreground">
            {t.phaseJourney(user.currentPhase)}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {currentPath && (
        <div className={`${currentPath.bgGradient} border ${currentPath.borderColor} rounded-2xl p-5 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 ${currentPath.iconBg} rounded-xl`}>
              <currentPath.icon className={`h-6 w-6 ${currentPath.iconColor}`} />
            </div>
            <div className="space-y-1">
              <p className={`font-bold text-lg ${currentPath.titleColor}`}>{currentPath.title}</p>
              <p className="text-sm text-muted-foreground">
                {currentPath.description}
              </p>
            </div>
          </div>
          <Button 
            className="rounded-xl px-6 font-bold shadow-lg hover:scale-[1.05] transition-transform" 
            onClick={() => router.push(currentPath.actionUrl)}
          >
            {currentPath.action}
          </Button>
        </div>
      )}

      {user.experienceLevel === "beginner" && user.currentPhase === 1 && !user.learningPath && (
        <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-2xl p-5 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-lg text-primary">{t.activeMission}</p>
              <p className="text-sm text-muted-foreground">{t.activeMissionDesc(1)}</p>
            </div>
          </div>
          <Button 
            className="rounded-xl px-6 font-bold shadow-lg shadow-primary/20 hover:scale-[1.05] transition-transform" 
            onClick={() => router.push("/phase/1")}
          >
            {t.goToPhase(1)}
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-streak">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{user.streak || 0}</p>
                <p className="text-sm text-muted-foreground">{t.dayStreak}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-weekly-goal">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">{Math.round(weekProgress)}%</p>
                <p className="text-sm text-muted-foreground">{t.weeklyGoal}</p>
                <Progress value={weekProgress} className="mt-2 h-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-practice-time">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{weeklyStats.practiceMinutes}</p>
                <p className="text-sm text-muted-foreground">{t.minutesThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-average-score">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(weeklyStats.averageScore)}%</p>
                <p className="text-sm text-muted-foreground">{t.averageScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t.yourLearningPath}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {phases
              .filter((phase) => phase.id <= user.currentPhase)
              .map((phase) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  isUnlocked={true}
                  isCompleted={phase.id < user.currentPhase}
                  progress={
                    phase.id < user.currentPhase
                      ? 100
                      : weeklyStats.currentPhaseProgress
                  }
                  onClick={() => router.push(`/phase/${phase.id}`)}
                />
              ))}
            {user.currentPhase < 3 && (
              <PhaseCard
                phase={phases[user.currentPhase]}
                isUnlocked={false}//locked/disabled
                isCompleted={false}//not completed
                progress={0}//shows zero progress
                onClick={() => {}}//nothing happens in locked
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t.quickActions}</h2>
          </div>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between h-auto py-4"
              onClick={() => router.push("/practice")}
              data-testid="button-quick-practice"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t.startPracticeLabel}</p>
                  <p className="text-xs text-muted-foreground">{t.voiceExercises}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between h-auto py-4"
              onClick={() => router.push("/routine-planner")}
              data-testid="button-routine-planner"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t.routinePlannerLabel}</p>
                  <p className="text-xs text-muted-foreground">{t.createPracticePlan}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between h-auto py-4"
              onClick={() => router.push("/learning-paths")}
              data-testid="button-learning-paths"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t.learningPathsLabel}</p>
                  <p className="text-xs text-muted-foreground">{t.chooseApproach}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </Button>

            {user.currentPhase >= 2 && (
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4"
                onClick={() => router.push("/songs")}
                data-testid="button-browse-songs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{t.browseSongsLabel}</p>
                    <p className="text-xs text-muted-foreground">{t.findSongs}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {user.currentPhase >= 3 && (
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-4"
                onClick={() => router.push("/perform")}
                data-testid="button-virtual-stage"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{t.virtualStageLabel}</p>
                    <p className="text-xs text-muted-foreground">{t.performSong}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {recentExercises.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t.recentActivity}</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/practice")}>
              {t.viewAll}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentExercises.slice(0, 3).map(({ exercise, progress }) => (
              <Card 
                key={progress.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/practice?exerciseId=${exercise.id}&phase=${exercise.phase}`)}
                data-testid={`card-recent-${exercise.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      progress={progress.overallScore || 0}
                      size={48}
                      strokeWidth={4}
                      showLabel={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{localizeExercise(exercise, lang).name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.score}: {Math.round(progress.overallScore || 0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
