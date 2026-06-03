"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Target,
  Zap,
  Music,
  Brain,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Rocket,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/language-context.jsx";

const pathIcons = {
  structured: { icon: Target, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", startUrl: "/phase/1" },
  intensive:  { icon: Zap,    color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20", startUrl: "/practice" },
  performance:{ icon: Music,  color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20", startUrl: "/songs" },
  adaptive:   { icon: Brain,  color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20", startUrl: "/routine-planner" },
  flexible:   { icon: Sparkles,color:"text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20", startUrl: "/practice" },
};


export default function WelcomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
  });

  if (isLoading) {
    return <WelcomeSkeleton />;
  }

  const currentPathId = user?.learningPath || "structured";
  const meta = pathIcons[currentPathId] || pathIcons.structured;
  const title = t.lp.paths[currentPathId]?.name || t.lp.paths.structured.name;
  const pathT = t.lpWelcome.paths[currentPathId] || t.lpWelcome.paths.structured;
  const Icon = meta.icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-background/50 backdrop-blur-sm relative overflow-hidden">
      <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full ${meta.bgColor} blur-3xl opacity-50`} />
      <div className={`absolute -bottom-20 -left-20 w-64 h-64 rounded-full ${meta.bgColor} blur-3xl opacity-50`} />

      <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <Rocket className="w-3 h-3" />
            {t.lpWelcome.confirmed}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
            {t.lpWelcome.welcomeTo("")}<br />
            <span className={`italic uppercase ${meta.color}`}>{title}</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-lg mx-auto leading-relaxed">
            {pathT.description}
          </p>
        </div>

        <Card className={`border-2 ${meta.borderColor} bg-background/60 backdrop-blur-xl shadow-2xl relative group overflow-hidden`}>
          <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-${meta.color.split('-')[1]}-500/5 opacity-50 group-hover:opacity-100 transition-opacity`} />

          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
              <div className={`w-20 h-20 rounded-2xl ${meta.bgColor} flex items-center justify-center shrink-0 border-2 ${meta.borderColor}`}>
                <Icon className={`w-10 h-10 ${meta.color}`} />
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-bold">{t.lpWelcome.whatsAhead}</h3>
                  <div className="grid gap-3">
                    {pathT.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle2 className={`w-5 h-5 ${meta.color} shrink-0`} />
                        <span className="text-sm font-semibold">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    size="lg"
                    className={`flex-1 font-bold text-lg h-14 shadow-xl ${meta.bgColor.replace('10', '90')} hover:scale-[1.02] transition-transform`}
                    onClick={() => router.push(meta.startUrl)}
                  >
                    {t.lpWelcome.startTraining}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="font-bold border-2"
                    onClick={() => router.push("/learning-paths")}
                  >
                    {t.lpWelcome.changePath}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="ghost" className="text-muted-foreground gap-2" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
            {t.lpWelcome.goToDashboard}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WelcomeSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8 animate-pulse">
        <div className="text-center space-y-4">
          <Skeleton className="h-6 w-32 mx-auto rounded-full" />
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
