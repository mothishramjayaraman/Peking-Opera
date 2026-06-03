"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Target,
  Zap,
  Music,
  Brain,
  Trophy,
  Clock,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Star,
  Flame,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast.js";
import { apiRequest, queryClient } from "@/lib/query-client.js";
import { useLanguage } from "@/lib/language-context.jsx";

export default function LearningPaths() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedPath, setSelectedPath] = useState(null);

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const learningPaths = [
    {
      id: "structured",
      name: t.lp.paths.structured.name,
      description: t.lp.paths.structured.description,
      icon: Target,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      gradient: "from-blue-600/20 to-indigo-600/5",
      glowColor: "group-hover:shadow-blue-500/20",
      duration: t.lp.paths.structured.duration,
      difficulty: t.lp.paths.structured.difficulty,
      focus: t.lp.paths.structured.focus,
      approach: t.lp.paths.structured.approach,
      benefits: t.lp.paths.structured.benefits,
      recommended: true,
    },
    {
      id: "intensive",
      name: t.lp.paths.intensive.name,
      description: t.lp.paths.intensive.description,
      icon: Zap,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/10",
      gradient: "from-orange-600/20 to-red-600/5",
      glowColor: "group-hover:shadow-orange-500/20",
      duration: t.lp.paths.intensive.duration,
      difficulty: t.lp.paths.intensive.difficulty,
      focus: t.lp.paths.intensive.focus,
      approach: t.lp.paths.intensive.approach,
      benefits: t.lp.paths.intensive.benefits,
      recommended: false,
    },
    {
      id: "performance",
      name: t.lp.paths.performance.name,
      description: t.lp.paths.performance.description,
      icon: Music,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
      gradient: "from-purple-600/20 to-pink-600/5",
      glowColor: "group-hover:shadow-purple-500/20",
      duration: t.lp.paths.performance.duration,
      difficulty: t.lp.paths.performance.difficulty,
      focus: t.lp.paths.performance.focus,
      approach: t.lp.paths.performance.approach,
      benefits: t.lp.paths.performance.benefits,
      recommended: false,
    },
    {
      id: "adaptive",
      name: t.lp.paths.adaptive.name,
      description: t.lp.paths.adaptive.description,
      icon: Brain,
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-500/10",
      gradient: "from-cyan-600/20 to-emerald-600/5",
      glowColor: "group-hover:shadow-cyan-500/20",
      duration: t.lp.paths.adaptive.duration,
      difficulty: t.lp.paths.adaptive.difficulty,
      focus: t.lp.paths.adaptive.focus,
      approach: t.lp.paths.adaptive.approach,
      benefits: t.lp.paths.adaptive.benefits,
      recommended: true,
    },
    {
      id: "flexible",
      name: t.lp.paths.flexible.name,
      description: t.lp.paths.flexible.description,
      icon: Sparkles,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10",
      gradient: "from-green-600/20 to-teal-600/5",
      glowColor: "group-hover:shadow-green-500/20",
      duration: t.lp.paths.flexible.duration,
      difficulty: t.lp.paths.flexible.difficulty,
      focus: t.lp.paths.flexible.focus,
      approach: t.lp.paths.flexible.approach,
      benefits: t.lp.paths.flexible.benefits,
      recommended: false,
    },
  ];

  const saveLearningPathMutation = useMutation({
    mutationFn: async (pathId) => {
      const response = await apiRequest("PATCH", "/api/user", {
        learningPath: pathId,
      });
      return response.json();
    },
    onSuccess: async (data, pathId) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      const pathName = learningPaths.find((p) => p.id === pathId)?.name;
      toast({
        title: t.lp.selectedToastTitle,
        description: t.lp.selectedToastDesc(pathName),
      });

      setTimeout(() => {
        router.push("/learning-path-welcome");
      }, 1000);
    },
    onError: () => {
      toast({
        title: t.lp.errorTitle,
        description: t.lp.errorDesc,
        variant: "destructive",
      });
    },
  });

  const handleSelectPath = (pathId) => {
    setSelectedPath(pathId);
  };

  const handleStartPath = () => {
    if (selectedPath) {
      saveLearningPathMutation.mutate(selectedPath);
    }
  };

  const getRecommendedPath = () => {
    if (!user) return "structured";

    switch (user.experienceLevel) {
      case "beginner":
        return "structured";
      case "intermediate":
        return "adaptive";
      case "advanced":
        return "performance";
      default:
        return "structured";
    }
  };

  const recommendedPathId = getRecommendedPath();

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto pb-40 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-4xl font-black tracking-tight italic">
              {t.lp.pageTitle} <span className="text-primary italic">{t.lp.pageTitleHighlight}</span>
            </h1>
          </div>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl">
            {t.lp.pageDesc}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="hidden md:flex gap-2 font-bold border-2 hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.lp.backToDashboard}
        </Button>
      </div>

      <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">
                {t.lp.recommendedFor(user?.experienceLevel || "you")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t.lp.recommendedDesc(
                  learningPaths.find((p) => p.id === recommendedPathId)?.name
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {learningPaths.map((path) => {
          const Icon = path.icon;
          const isSelected = selectedPath === path.id;
          const isRecommended = path.id === recommendedPathId;

          return (
            <Card
              key={path.id}
              className={`group cursor-pointer transition-all duration-300 hover:shadow-2xl overflow-hidden relative ${
                isSelected
                  ? "ring-2 ring-primary shadow-2xl scale-[1.02] z-10"
                  : "hover:scale-[1.01] grayscale-[0.2] hover:grayscale-0"
              } ${path.glowColor}`}
              onClick={() => handleSelectPath(path.id)}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${path.gradient} opacity-40 group-hover:opacity-60 transition-opacity`}
              />

              <div className="relative z-10">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-12 h-12 rounded-lg ${path.bgColor} flex items-center justify-center`}
                    >
                      <Icon className={`h-6 w-6 ${path.color}`} />
                    </div>
                    {isRecommended && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Star className="h-3 w-3 mr-1" />
                        {t.lp.recommended}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{path.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {path.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {path.duration}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {path.difficulty}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.lp.focusAreas}</p>
                    <div className="flex flex-wrap gap-2">
                      {path.focus.map((area, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs"
                        >
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.lp.approach}</p>
                    <p className="text-xs text-muted-foreground">
                      {path.approach}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.lp.benefits}</p>
                    <ul className="space-y-1">
                      {path.benefits.slice(0, 3).map((benefit, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className="w-full"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPath(path.id);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {t.lp.selected}
                      </>
                    ) : (
                      t.lp.selectPath
                    )}
                  </Button>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedPath && (
        <div className="sticky bottom-6 z-50 animate-in fade-in slide-in-from-bottom-4 px-4">
          <Card className="border-white/10 bg-background/60 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border-[0.5px]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    {(() => {
                      const path = learningPaths.find(
                        (p) => p.id === selectedPath,
                      );
                      const Icon = path?.icon || Target;
                      return <Icon className="h-6 w-6 text-primary" />;
                    })()}
                  </div>
                  <div>
                    <p className="font-bold">
                      {learningPaths.find((p) => p.id === selectedPath)?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.lp.readyToStart}
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={handleStartPath}
                  className="gap-2 font-bold px-8"
                  disabled={saveLearningPathMutation.isPending}
                >
                  {saveLearningPathMutation.isPending
                    ? t.lp.configuring
                    : t.lp.launchPath}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t.lp.notSureTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {t.lp.notSureDesc1}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.lp.notSureDesc2}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
