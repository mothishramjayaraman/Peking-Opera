"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Music, Target, RotateCcw, Moon, Sun, LogOut, Lock, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme.js";
import { useToast } from "@/hooks/use-toast.js";
import { apiRequest, queryClient } from "@/lib/query-client.js";
import { passwordSchema } from "../../../shared/constants.js";
import { useLanguage } from "@/lib/language-context.jsx";

const settingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

export default function Settings() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
  });

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      email: "",
      experienceLevel: "",
    },
    values: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      experienceLevel: user?.experienceLevel ?? "",
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest("PATCH", `/api/user`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phase"] });
      router.refresh();
      toast({
        title: t.settings.savedTitle,
        description: t.settings.savedDesc,
      });
    },
    onError: () => {
      toast({
        title: t.settings.errorTitle,
        description: t.settings.errorDesc,
        variant: "destructive",
      });
    },
  });

  const resetProgressMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reset-progress", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: t.settings.progressResetTitle,
        description: t.settings.progressResetDesc,
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
  });

  const onSubmit = (data) => {
    const phaseMap = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };
    const updatedData = {
      ...data,
      currentPhase: phaseMap[data.experienceLevel],
    };
    updateUserMutation.mutate(updatedData);
  };

  const experienceLevels = [
    { value: "beginner", label: t.settings.beginner },
    { value: "intermediate", label: t.settings.intermediate },
    { value: "advanced", label: t.settings.advanced },
  ];

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
      </div>

      <Card data-testid="card-profile">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t.settings.profileSettings}
          </CardTitle>
          <CardDescription>{t.settings.manageProfile}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.settings.name}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.settings.emailAddress}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="your@email.com"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="experienceLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.settings.experienceLevel}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-experience">
                          <SelectValue placeholder={t.settings.selectExperience} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {experienceLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateUserMutation.isPending ? t.settings.saving : t.settings.saveChanges}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card data-testid="card-password">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t.settings.resetPassword}
          </CardTitle>
          <CardDescription>{t.settings.updateSecurity}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password-input">{t.settings.newPassword}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t.settings.passwordPlaceholder}
                  id="new-password-input"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={async () => {
                  const input = document.getElementById("new-password-input");
                  const password = input.value;
                  const result = passwordSchema.safeParse(password);
                  if (!result.success) {
                    toast({
                      title: t.settings.invalidPasswordTitle,
                      description: result.error.errors[0].message,
                      variant: "destructive",
                    });
                    return;
                  }
                  try {
                    await apiRequest("POST", "/api/user/password", { password });
                    toast({
                      title: t.settings.passwordUpdatedTitle,
                      description: t.settings.passwordUpdatedDesc,
                    });
                    input.value = "";
                  } catch (error) {
                    toast({
                      title: t.settings.errorTitle,
                      description: t.settings.passwordErrorDesc,
                      variant: "destructive",
                    });
                  }
                }}
              >
                {t.settings.resetPassword}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-appearance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {t.settings.appearance}
          </CardTitle>
          <CardDescription>{t.settings.customizeApp}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{theme === "dark" ? t.settings.darkMode : t.settings.lightMode}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.switchTheme}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={toggleTheme}
              data-testid="button-toggle-theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  {t.settings.lightMode}
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  {t.settings.darkMode}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-account-actions" className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            {t.settings.accountActions}
          </CardTitle>
          <CardDescription>{t.settings.manageAccount}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium">{t.settings.signOut}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.signOutDesc}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await apiRequest("POST", "/api/logout");
                window.location.href = "/";
              }}
              className="hover:bg-destructive hover:text-destructive-foreground transition-all"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t.settings.signOut}
            </Button>
          </div>

          <div className="pt-6 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-destructive">{t.settings.resetProgress}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.resetProgressDesc}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm(t.settings.resetConfirm)) {
                  resetProgressMutation.mutate();
                }
              }}
              disabled={resetProgressMutation.isPending}
              data-testid="button-reset-progress"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t.settings.resetAllProgress}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Skeleton className="w-9 h-9 rounded-md" />
        <Skeleton className="h-7 w-24" />
      </div>

      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}
