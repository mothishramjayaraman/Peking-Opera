"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  Square,
  RotateCcw,
  Loader2,
  AlertCircle,
  Music,
  Gauge,
  ArrowLeft,
  Check,
  Upload,
  Zap,
  Star,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { WaveformVisualizer } from "@/components/waveform-visualizer";
import { AudioPlayer } from "@/components/audio-player";
import { ScoreDisplay } from "@/components/score-display";
import { ExerciseCard } from "@/components/exercise-card";
import { analyzeVoice } from "@/lib/mock-ai";
import { apiRequest, queryClient } from "@/lib/query-client.js";
import { frequencyToNote } from "@/lib/audio-utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context.jsx";
import { localizeExercise } from "@/lib/exercise-locale.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExerciseDemo } from "@/components/exercise-demo";

export default function Practice() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <PracticeContent />
    </Suspense>
  );
}

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t, lang } = useLanguage();

  const [songFromLibrary, setSongFromLibrary] = useState(null);
  const [backingTrackInfo, setBackingTrackInfo] = useState(null);

  useEffect(() => {
    // Access state from window.history.state
    if (typeof window !== "undefined" && window.history.state) {
      setSongFromLibrary(window.history.state.song);
      setBackingTrackInfo(window.history.state.backingTrack);
    }
  }, []);

  const [selectedExercise, setSelectedExercise] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    analyserData,
    pitch,
    clarity,
    error,
    startRecording,
    stopRecording,
    resetRecording,
    loadAudioFile,
  } = useAudioRecorder();

  const fileInputRef = useRef(null);

  const currentNote = pitch ? frequencyToNote(pitch) : null;

  const phaseInUrl = searchParams.get("phase");
  const fromInUrl = searchParams.get("from");
  const exerciseIdInUrl = searchParams.get("exerciseId");
  const routineIdInUrl = searchParams.get("routineId");

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      phaseInUrl ? `/api/exercises?phase=${phaseInUrl}` : "/api/exercises",
    ],
    staleTime: 0,
  });

  const { data: routines } = useQuery({
    queryKey: ["/api/practice-routines"],
    enabled: !!routineIdInUrl,
  });

  const currentRoutine = routines?.find(r => r.id.toString() === routineIdInUrl);
  const displayExercises = routineIdInUrl 
    ? (currentRoutine?.exercises || []) 
    : data?.exercises;

  const { data: historyData } = useQuery({
    queryKey: ["/api/voice-analysis", selectedExercise?.id],
    queryFn: async () => {
      if (!selectedExercise) return [];
      const res = await fetch(`/api/voice-analysis?exerciseId=${selectedExercise.id}`);
      return res.json();
    },
    enabled: !!selectedExercise,
  });

  useEffect(() => {
    if (data?.exercises && exerciseIdInUrl) {
      if (!selectedExercise || selectedExercise.id !== exerciseIdInUrl) {
        const exercise = data.exercises.find((e) => e.id === exerciseIdInUrl);
        if (exercise) {
          setSelectedExercise(exercise);
        }
      }
    }
  }, [data, exerciseIdInUrl, selectedExercise]);

  //save the progress after analysis
  const saveProgressMutation = useMutation({
    //sends analysis results to the server
    mutationFn: async (analysis) => {
      if (!selectedExercise) return;
      const response = await apiRequest("POST", "/api/exercise-progress", {
        exerciseId: selectedExercise.id,
        pitchScore: analysis.pitchAccuracy,
        toneScore: analysis.toneStability,
        breathingScore: analysis.breathingConsistency,
        overallScore: analysis.overallRating,
        feedback: [
          ...(analysis.technicalStrengths || []).map((s) => `Strength: ${s}`),
          ...(analysis.detectedMistakes || []).map((m) => `Mistake: ${m}`),
          ...(analysis.suggestions || []).map((s) => `Suggestion: ${s}`),
        ].join("; "),
        generativeFeedback: analysis.generativeFeedback,
      });
      return response.json();
    },

    //when saving it refreshes dashboard for ui update like streak...
    onSuccess: async () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/exercises"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phase"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (selectedExercise) {
        queryClient.invalidateQueries({ queryKey: ["/api/voice-analysis", selectedExercise.id] });
      }
      if (selectedExercise) {
        toast({
          title: t.practice.practiceSavedTitle,
          description: t.practice.practiceSavedDesc,
        });
      }
    },
    onError: (error) => {
      const msg = error?.message || "";
      if (msg.startsWith("401")) {
        toast({
          title: t.practice.sessionExpiredTitle,
          description: t.practice.sessionExpiredDesc,
          variant: "destructive",
        });
        router.push("/auth");
        return;
      }
      if (msg.startsWith("404")) {
        toast({
          title: t.practice.exerciseNotFoundTitle,
          description: t.practice.exerciseNotFoundDesc,
          variant: "destructive",
        });
        router.push("/practice");
        return;
      }
      toast({
        title: t.practice.saveFailedTitle,
        description: t.practice.saveFailedDesc,
        variant: "destructive",
      });
    },
  });

  const saveVoiceAnalysisMutation = useMutation({
    mutationFn: async (analysis) => {
      const response = await apiRequest(
        "POST",
        "/api/voice-analysis",
        analysis,
      );
      return response.json();
    },
  });
  //analyse button
  const handleAnalyze = async () => {
    if (!audioBlob) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeVoice(
        audioBlob,
        "exercise",
        selectedExercise,
      ); //sends the blob to analyzer
      setAnalysisResult(result); //display the result
      saveProgressMutation.mutate(result); // saves to /api/exercise-progress
      saveVoiceAnalysisMutation.mutate({ ...result, exerciseId: selectedExercise?.id }); // saves to /api/voice-analysis
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    resetRecording();
    setAnalysisResult(null);
  };

  const handleStartExercise = (exercise) => {
    setSelectedExercise(exercise);
    handleReset();

    const params = new URLSearchParams(searchParams);
    params.set("exerciseId", exercise.id);
    router.push(`/practice?${params.toString()}`, { scroll: false });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return <PracticeSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (phaseInUrl) {
              router.push(`/phase/${phaseInUrl}`);
            } else if (fromInUrl === "routine") {
              router.push("/routine-planner");
            } else {
              router.push("/dashboard");
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {songFromLibrary
              ? t.practice.titleSong(songFromLibrary.title)
              : t.practice.titleVoice}
          </h1>
          <p className="text-muted-foreground">
            {songFromLibrary
              ? t.practice.subtitleSong(songFromLibrary.artist, songFromLibrary.genre, songFromLibrary.key, songFromLibrary.bpm)
              : t.practice.subtitleVoice}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">{t.practice.important}</span> {t.practice.micWarning}
        </p>
      </div>

      {songFromLibrary && backingTrackInfo && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{t.practice.songPracticeMode}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {backingTrackInfo.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t.practice.difficulty}</p>
                    <p className="font-medium capitalize">
                      {songFromLibrary.difficulty}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t.practice.vocalRange}</p>
                    <p className="font-medium capitalize">
                      {songFromLibrary.vocalRange}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t.practice.key}</p>
                    <p className="font-medium">{songFromLibrary.key}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t.practice.tempo}</p>
                    <p className="font-medium">{songFromLibrary.bpm} BPM</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">{t.practice.practiceTipsTitle}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {t.practice.practiceTips(songFromLibrary.key, songFromLibrary.bpm).map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {user?.learningPath && (
        <Card
          className={`${
            user.learningPath === "flexible"
              ? "bg-gradient-to-r from-green-500/10 to-transparent border-green-500/20"
              : user.learningPath === "competitive"
                ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20"
                : user.learningPath === "intensive"
                  ? "bg-gradient-to-r from-red-500/10 to-transparent border-red-500/20"
                  : user.learningPath === "performance"
                    ? "bg-gradient-to-r from-pink-500/10 to-transparent border-pink-500/20"
                    : user.learningPath === "adaptive"
                      ? "bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/20"
                      : "bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20"
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  user.learningPath === "flexible"
                    ? "bg-green-500/20"
                    : user.learningPath === "competitive"
                      ? "bg-yellow-500/20"
                      : user.learningPath === "intensive"
                        ? "bg-red-500/20"
                        : user.learningPath === "performance"
                          ? "bg-pink-500/20"
                          : user.learningPath === "adaptive"
                            ? "bg-purple-500/20"
                            : "bg-blue-500/20"
                }`}
              >
                {user.learningPath === "flexible" && (
                  <span className="text-2xl">✨</span>
                )}
                {user.learningPath === "competitive" && (
                  <span className="text-2xl">🏆</span>
                )}
                {user.learningPath === "intensive" && (
                  <span className="text-2xl">⚡</span>
                )}
                {user.learningPath === "performance" && (
                  <span className="text-2xl">🎭</span>
                )}
                {user.learningPath === "adaptive" && (
                  <span className="text-2xl">🤖</span>
                )}
                {user.learningPath === "structured" && (
                  <span className="text-2xl">📚</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  {(t.practice.pathModes[user.learningPath] || t.practice.pathModes.structured).title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {(t.practice.pathModes[user.learningPath] || t.practice.pathModes.structured).desc}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card data-testid="card-recorder">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedExercise &&
                  data?.completedIds.includes(selectedExercise.id) && (
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                {songFromLibrary
                  ? t.practice.singTitle(songFromLibrary.title)
                  : selectedExercise
                    ? localizeExercise(selectedExercise, lang).name
                    : t.practice.voiceRecorder}
              </CardTitle>
              <CardDescription>
                {songFromLibrary
                  ? t.practice.practiceDesc
                  : selectedExercise
                    ? selectedExercise.description
                    : t.practice.selectExercise}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {selectedExercise && (
                <Tabs defaultValue="instructions">
                  <TabsList className="w-full">
                    <TabsTrigger value="instructions" className="flex-1">
                      {t.practice.instructions}
                    </TabsTrigger>
                    <TabsTrigger value="demo" className="flex-1">
                      {t.practice.demo}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex-1">
                      History
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="instructions">
                    <div className="bg-muted rounded-lg p-4 space-y-4">
                      {selectedExercise?.targetMetrics && selectedExercise.targetMetrics.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-primary flex items-center gap-2">
                            <Zap className="h-4 w-4" /> Key Focus Areas
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedExercise.targetMetrics.map(metric => (
                              <span key={metric} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize border border-primary/20">
                                {metric}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-foreground">Instructions</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {selectedExercise.instructions}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="demo">
                    <ExerciseDemo exercise={selectedExercise} />
                  </TabsContent>
                  <TabsContent value="history">
                    <div className="space-y-4">
                      {historyData && historyData.length > 0 ? (
                        historyData.map((item) => (
                          <div key={item.id} className="bg-muted rounded-lg p-4 border border-border/50">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-semibold text-sm">
                                  {new Date(item.analyzedAt).toLocaleDateString()} {new Date(item.analyzedAt).toLocaleTimeString()}
                                </p>
                                <p className="text-xs text-muted-foreground">Overall Score: {item.overallRating}</p>
                              </div>
                            </div>
                            {item.audioUrl && (
                              <audio controls src={item.audioUrl} className="w-full h-10 mb-3" />
                            )}
                            <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border">
                              <p className="line-clamp-3">
                                {item.generativeFeedback}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No past recordings found for this exercise.</p>
                          <p className="text-sm">Complete a practice session to see it here.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex flex-col items-center space-y-6">
                <WaveformVisualizer
                  analyserData={analyserData}
                  isRecording={isRecording}
                  className="h-20"
                />

                <div className="flex flex-col items-center gap-2">
                  <div
                    className="text-4xl font-mono tabular-nums"
                    data-testid="text-duration"
                  >
                    {formatTime(duration)}
                  </div>
                  {isRecording && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                      <div className="text-2xl font-bold text-primary">
                        {currentNote || "--"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pitch ? `${Math.round(pitch)} Hz` : "Listening..."}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  {!isRecording && !audioUrl && (
                    <>
                      <Button
                        size="lg"
                        onClick={startRecording}
                        className="w-20 h-20 rounded-full"
                        data-testid="button-start-recording"
                      >
                        <Mic className="h-8 w-8" />
                      </Button>
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="file"
                          className="hidden"
                          accept="audio/*"
                          ref={fileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) loadAudioFile(file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-14 h-14 rounded-full border-dashed bg-muted/30 hover:bg-muted/50"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-upload"
                          title="Upload audio file"
                        >
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                          {t.practice.upload}
                        </span>
                      </div>
                    </>
                  )}

                  {isRecording && (
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={stopRecording}
                      className="w-20 h-20 rounded-full animate-pulse"
                      data-testid="button-stop-recording"
                    >
                      <Square className="h-8 w-8" />
                    </Button>
                  )}

                  {audioUrl && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleReset}
                        data-testid="button-reset"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </Button>

                      {/* analyse voice */}
                      {!analysisResult && (
                        <Button
                          size="lg"
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          data-testid="button-analyze"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {t.practice.analyzing}
                            </>
                          ) : (
                            t.practice.analyzeVoice
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {audioUrl && (
                  <div className="w-full max-w-md">
                    <AudioPlayer audioUrl={audioUrl} duration={duration} />
                  </div>
                )}
              </div>

              {/* display analysis result in ui */}
              {analysisResult && (
                <div className="space-y-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-center">
                    {t.practice.analysisResults}
                  </h3>
                  <ScoreDisplay
                    pitchScore={analysisResult.pitchAccuracy}
                    toneScore={analysisResult.toneStability}
                    breathingScore={analysisResult.breathingConsistency}
                    vibratoScore={analysisResult.vibratoScore}
                    expressionScore={analysisResult.expressionScore}
                    overallScore={analysisResult.overallRating}
                    highlightedMetrics={selectedExercise?.targetMetrics}
                  />
                  {/* (feedback)text shown after analysis */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-primary/20 rounded-lg">
                          <Mic className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-bold text-lg">
                          {t.practice.aiCoach}
                        </h4>
                      </div>

                      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                        {(Array.isArray(analysisResult.generativeFeedback)
                          ? analysisResult.generativeFeedback.join("\n")
                          : typeof analysisResult.generativeFeedback === "string" 
                            ? analysisResult.generativeFeedback 
                            : t.practice.defaultFeedback
                        )
                          .split("\n")
                          .filter(Boolean)
                          .map((para, i) => (
                            <p key={i} className="mb-3 last:mb-0">
                              {para}
                            </p>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      {analysisResult.technicalStrengths &&
                        analysisResult.technicalStrengths.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                              <Star className="h-4 w-4" />
                              {t.practice.technicalStrengths}
                            </h4>
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {analysisResult.technicalStrengths.map(
                                (strength, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 transition-colors text-sm"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                    {strength}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                      {analysisResult.detectedMistakes &&
                        analysisResult.detectedMistakes.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              {t.practice.detectedMistakes}
                            </h4>
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {analysisResult.detectedMistakes.map(
                                (mistake, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/30 transition-colors text-sm"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                    {mistake}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          {t.practice.suggestions}
                        </h4>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {analysisResult.suggestions.map((suggestion, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10 hover:border-green-500/30 transition-colors text-sm"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleReset}
                    data-testid="button-try-again"
                  >
                    {t.practice.tryAgain}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* shows all Exercise card  */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            {currentRoutine ? t.routine?.title || "Routine Exercises" : t.practice.exercises}
          </h2>
          <div className="space-y-3">
            {displayExercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                isCompleted={data?.completedIds?.includes(exercise.id)}
                score={data?.scores?.[exercise.id]}
                onStart={handleStartExercise}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PracticeSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
