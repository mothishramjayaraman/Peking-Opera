"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, Mic, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";


export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [experienceLevel, setExperienceLevel] = useState("beginner");

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
  });

  const updateLevelMutation = useMutation({
    mutationFn: async (level) => {
      // Mapping experience level to phase
      const phaseMap = {
        beginner: 1,
        intermediate: 2,
        advanced: 3
      };
      
      const response = await apiRequest("PATCH", "/api/user", { 
        experienceLevel: level,
        currentPhase: phaseMap[level]
      });
      return response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ 
        title: "Welcome onboard!", 
        description: `Your journey starts as a ${experienceLevel} singer.` 
      });
      router.push("/dashboard");
    },
    onError: (error) => {
      toast({ 
        title: "Update failed", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const levels = [
    { value: "beginner", label: "Beginner", description: "New to singing. Focus on fundamentals." },
    { value: "intermediate", label: "Intermediate", description: "Some experience. Refine your technique." },
    { value: "advanced", label: "Advanced", description: "Extensive training. Master performance." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
            <Mic className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">One Last Step</h1>
          <p className="text-muted-foreground text-lg italic">
            What is your current singing experience level?
          </p>
        </div>

        <div className="space-y-6">
          <RadioGroup 
            value={experienceLevel} 
            onValueChange={setExperienceLevel} 
            className="space-y-4"
          >
            {levels.map((level) => (
              <label key={level.value} className="block cursor-pointer">
                <Card className={`transition-all duration-300 ${
                  experienceLevel === level.value 
                    ? "border-primary ring-2 ring-primary/20 scale-[1.02] shadow-lg" 
                    : "hover:border-primary/50"
                }`}>
                  <CardContent className="p-6 flex items-center gap-4">
                    <RadioGroupItem value={level.value} className="sr-only" />
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      experienceLevel === level.value ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Star className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{level.label}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {level.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </label>
            ))}
          </RadioGroup>

          <Button 
            className="w-full h-14 rounded-2xl text-xl font-bold italic shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all group"
            onClick={() => updateLevelMutation.mutate(experienceLevel)}
            disabled={updateLevelMutation.isPending}
          >
            {updateLevelMutation.isPending ? "Setting up..." : "Start Your Journey"}
            <ChevronRight className="h-6 w-6 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}
