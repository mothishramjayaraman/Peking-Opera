"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Mic, ChevronRight, ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/query-client.js";
import { insertUserSchema } from "../../shared/constants.js";
import { useToast } from "@/hooks/use-toast";
import { sendConfirmationEmail } from "@/lib/email.js";

const loginSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const onboardingSchema = insertUserSchema;

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const initialTab =
    searchParams.get("tab") === "register" ? "register" : "login";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update active tab when search params change
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "register" || tab === "login") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Display errors from URL
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast({
        title: "Authentication Error",
        description: decodeURIComponent(error),
        variant: "destructive",
      });

      // Clear the error from the URL without refreshing
      const url = new URL(window.location);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams, toast]);

  // Login Form
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  // Onboarding Form
  const onboardingForm = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      experienceLevel: "beginner",
      vocalRange: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", "/api/login", {
        username: data.username,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      if (user.email) {
        sendConfirmationEmail(user.name, user.email).catch(console.error);
      }
      router.push("/dashboard");
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password.",
        variant: "destructive",
      });
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      if (user.email) {
        sendConfirmationEmail(user.name, user.email).catch(console.error);
      }
      router.push("/dashboard");
      toast({
        title: "Account created!",
        description: "Welcome to your singing journey.",
      });
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account.",
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data) => {
    loginMutation.mutate(data);
  };

  const onOnboardingSubmit = (data) => {
    onboardingMutation.mutate(data);
  };

  const experienceLevels = [
    { value: "beginner", label: "Beginner", description: "New to singing" },
    {
      value: "intermediate",
      label: "Intermediate",
      description: "Some experience",
    },
    { value: "advanced", label: "Advanced", description: "Extensive training" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side: Illustration & Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center text-primary-foreground p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-0 -left-1/4 w-[800px] h-[800px] border border-white/20 rounded-full" />
          <div className="absolute bottom-0 -right-1/4 w-[600px] h-[600px] border border-white/20 rounded-full" />
        </div>

        <div className="relative z-10 max-w-lg space-y-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
              <Mic className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">SingSmart AI</h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-5xl font-extrabold leading-tight">
              Master 京剧 with AI.
            </h2>
            <p className="text-xl text-primary-foreground/80 leading-relaxed">
              Train 旦角, 生角, and 净角 voice roles with real-time 行腔 feedback
              and AI-powered Peking Opera coaching.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 italic font-mono text-sm">
                Real-time
              </div>
              <p className="font-semibold text-lg">Pitch Detection</p>
              <p className="font-semibold text-lg">Breath control</p>
              <p className="font-semibold text-lg">vibrato Detection</p>
              <p className="font-semibold text-lg">Expression Detection</p>
              <p className="font-semibold text-lg">Tone Analysis</p>
            </div>
            <div className="space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 italic font-mono text-sm">
                Professional
              </div>
              <p className="font-semibold text-lg">AI Coaching</p>
              <p className="font-semibold text-lg">Generative Feedback</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Forms */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="absolute top-8 right-8 gap-2 hover:bg-muted/80"
        >
          Back to Home
          <ArrowLeft className="h-4 w-4 rotate-180" />
        </Button>

        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center space-y-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Mic className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold">SingSmart AI</h2>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-8 rounded-full p-1 h-12 bg-muted/50">
              <TabsTrigger
                value="login"
                className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-10"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all h-10"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                New Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold">Welcome Back</h3>
                <p className="text-muted-foreground italic">
                  Sign in to continue your practice
                </p>
              </div>

              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your username"
                            {...field}
                            className="rounded-xl h-12 px-4"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter password"
                            {...field}
                            className="rounded-xl h-12 px-4"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-lg font-bold transition-all hover:scale-[1.02]"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-2 hover:bg-muted/50 transition-all font-semibold"
                onClick={() =>
                  (window.location.href = "/api/auth/google?mode=login")
                }
              >
                <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
                Continue with Google
              </Button>
            </TabsContent>

            <TabsContent value="register">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold">Create Account</h3>
                  <p className="text-muted-foreground italic">
                    Step {step} of 2
                  </p>
                </div>

                {step === 1 && (
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl border-2 hover:bg-muted/50 transition-all font-semibold mb-2"
                      onClick={() =>
                        (window.location.href = "/api/auth/google?mode=signup")
                      }
                    >
                      <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
                      Sign up with Google
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or use details
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Form {...onboardingForm}>
                  <form
                    onSubmit={onboardingForm.handleSubmit(onOnboardingSubmit)}
                    className="space-y-6"
                  >
                    {step === 1 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <FormField
                          control={onboardingForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Choose a username"
                                  {...field}
                                  className="rounded-xl h-12 px-4"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={onboardingForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="your@email.com"
                                  {...field}
                                  className="rounded-xl h-12 px-4"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={onboardingForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Min. 8 chars, A-Z, a-z, 0-9, !@#"
                                  {...field}
                                  className="rounded-xl h-12 px-4"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          onClick={async () => {
                            const isValid = await onboardingForm.trigger([
                              "name",
                              "email",
                              "password",
                            ]);
                            if (isValid) {
                              setStep(2);
                            }
                          }}
                          className="w-full h-12 rounded-xl text-lg font-bold"
                        >
                          Continue
                          <ChevronRight className="h-5 w-5 ml-1" />
                        </Button>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <FormField
                          control={onboardingForm.control}
                          name="experienceLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Experience Level</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="space-y-3"
                                >
                                  {experienceLevels.map((level) => (
                                    <label
                                      key={level.value}
                                      className="cursor-pointer"
                                    >
                                      <Card
                                        className={`transition-all ${field.value === level.value ? "border-primary ring-1 ring-primary" : ""}`}
                                      >
                                        <CardContent className="p-4 flex items-center gap-4">
                                          <RadioGroupItem value={level.value} />
                                          <div>
                                            <p className="font-medium">
                                              {level.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {level.description}
                                            </p>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep(1)}
                            className="flex-1 h-12 rounded-xl"
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                            disabled={onboardingMutation.isPending}
                          >
                            {onboardingMutation.isPending
                              ? "Setting up..."
                              : "Finish"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </Form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
