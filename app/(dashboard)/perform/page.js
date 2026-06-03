"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Mic,
  Square,
  Users,
  Star,
  Sparkles,
  Volume2,
  Music,
  Loader2,
  Trophy,
  ChevronRight,
  RotateCcw,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAudioRecorder } from "@/hooks/use-audio-recorder.js";
import { useToast } from "@/hooks/use-toast.js";
import { queryClient } from "@/lib/query-client.js";
import { WaveformVisualizer } from "@/components/waveform-visualizer.jsx";
import { AudioPlayer } from "@/components/audio-player.jsx";
import { ScoreDisplay } from "@/components/score-display.jsx";
import { PassaggioNavigator } from "@/components/passaggio-navigator.jsx";
import { analyzeVoice, generateAudienceReactions } from "@/lib/mock-ai.js";
import { frequencyToNote } from "@/lib/audio-utils.js";
import { useLanguage } from "@/lib/language-context.jsx";

// Suspense wrapper needed because useSearchParams requires it in Next.js App Router
export default function Perform() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <PerformContent />
    </Suspense>
  );
}

function PerformContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  // song to perform, whether this is a phase final test, and where to go back
  const songId = searchParams.get("songId");
  const isTest = searchParams.get("isTest") === "true";
  const phaseInUrl = searchParams.get("phase");
  const fromInUrl = searchParams.get("from");

  // only fetch song detail if a songId was provided
  const { data: song, isLoading: isLoadingSong } = useQuery({
    queryKey: ["/api/song-detail", songId],
    enabled: !!songId,
  });

  // stage state machine: idle → performing → analyzing → results
  const [state, setState] = useState("idle");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [audienceReaction, setAudienceReaction] = useState(null);

  // mic recording hook: provides pitch, volume, waveform data, blob, and controls
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    analyserData,
    pitch,
    volumeLevel,
    levelWarning,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // convert raw Hz pitch to note name (e.g. 440Hz → A4)
  const currentNote = pitch ? frequencyToNote(pitch) : null;

  const handleStartPerformance = async () => {
    setState("performing");
    await startRecording();
  };

  const handleStopPerformance = async () => {
    await stopRecording();
    setState("analyzing");
  };

  const { toast } = useToast();

  // runs after recording stops: analyze voice, generate reactions, save to DB
  useEffect(() => {
    const analyzePerformance = async () => {
      if (state === "analyzing" && audioBlob) {
        try {
          // mock AI scores pitch, tone, breathing, vibrato, expression
          const analysis = await analyzeVoice(audioBlob, "chinese_opera");
          setAnalysisResult(analysis);

          // generate simulated crowd reactions based on overall score
          const reactions = await generateAudienceReactions(
            analysis.overallRating,
            song?.title,
            song?.artist,
          );
          setAudienceReaction(reactions);

          // persist performance record to the database
          const res = await fetch("/api/performances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              songId: songId,
              performanceScore: analysis.overallRating,
              audienceReactions: reactions.reactions,
            }),
          });

          // advance phase if this was a final test and score >= 70
          if (res.ok && isTest && analysis.overallRating >= 70 && song?.phase) {
            // Update user phase if they passed the test
            const nextPhase = Number(song.phase) + 1;
            await fetch("/api/user", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPhase: nextPhase }),
            });

            toast({
              title: "Phase Complete! 🎉",
              description: `Congratulations! You've unlocked Phase ${nextPhase}.`,
            });
          }

          // refresh all queries that depend on phase/performance data
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["/api/phase"] });
          queryClient.invalidateQueries({ queryKey: ["/api/performances"] });
          router.refresh();
        } catch (err) {
          console.error("Failed to analyze performance:", err);
        }

        setState("results");
      }
    };

    analyzePerformance();
  }, [audioBlob, state, songId, isTest, song?.phase, toast]);

  // ref attached to the active lyric line so it can auto-scroll into view
  const activeLyricRef = useRef(null);

  // scroll active lyric into center whenever recording duration ticks
  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [duration]);

  // clear all state and go back to idle
  const handleReset = () => {
    resetRecording();
    setAnalysisResult(null);
    setAudienceReaction(null);
    setState("idle");
  };

  const handlePlayReferencePitch = () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const hz = song?.startingPitchHz || 440; // Default to A4 (440Hz)
    
    // Create oscillators for a Jinghu (Peking Opera fiddle) style sound
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const vibrato = audioCtx.createOscillator();
    const vibratoGain = audioCtx.createGain();
    const mainGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // Jinghu has a bright, piercing, bowed string sound
    osc1.type = "sawtooth";
    osc2.type = "square";
    
    // Vibrato setup (Jinghu has very distinct, wide, emotional vibrato)
    vibrato.type = "sine";
    vibrato.frequency.value = 6.5; // 6.5 Hz vibrato rate
    vibratoGain.gain.value = hz * 0.05; // Vibrato depth (5% pitch modulation)
    
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);

    osc1.frequency.setValueAtTime(hz, audioCtx.currentTime);
    osc2.frequency.setValueAtTime(hz * 1.002, audioCtx.currentTime); // Slight detuning for thickness

    // Filter to make it piercing but not physically painful (emphasize overtones)
    filter.type = "bandpass";
    filter.frequency.value = hz * 2.5; 
    filter.Q.value = 1.2;

    // Bowing envelope (ADSR)
    mainGain.gain.setValueAtTime(0, audioCtx.currentTime);
    mainGain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.15); // Bow attack
    mainGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 2.5);  // Sustain
    mainGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.0); // Release

    // Connect audio graph
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Play
    vibrato.start(audioCtx.currentTime);
    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime);
    
    // Stop after 3 seconds
    vibrato.stop(audioCtx.currentTime + 3.0);
    osc1.stop(audioCtx.currentTime + 3.0);
    osc2.stop(audioCtx.currentTime + 3.0);
  };

  // format seconds as m:ss for the recording timer
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // maps applause level string to an icon + repeat count for the result display
  const getApplauseEmoji = (level) => {
    const icons = {
      light: { icon: Star, count: 1 },
      moderate: { icon: Star, count: 2 },
      enthusiastic: { icon: Star, count: 3 },
      standing_ovation: { icon: Sparkles, count: 4 },
    };
    return icons[level] || icons.light;
  };

  // fetch user for phase gate check
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["/api/user"],
  });

  // spinner while song or user data loads
  if (isLoadingSong || isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // gate: Virtual Stage requires Phase 3+ (bypassed for final tests)
  if (user && user.currentPhase < 3 && !isTest) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-muted-foreground"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">{t.perform.notAvailable}</h2>
        <p className="text-muted-foreground mb-4">
          {t.perform.notAvailableDesc}
        </p>
        <Button onClick={() => router.push("/dashboard")}>
          {t.perform.backToDashboard}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* page header: back button + title (changes for final test mode) */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            // smart back: return to phase page, songs page, or dashboard
            if (phaseInUrl) {
              router.push(`/phase/${phaseInUrl}`);
            } else if (fromInUrl === "songs") {
              router.push("/songs");
            } else {
              router.push("/dashboard");
            }
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isTest
              ? t.perform.finalTestTitle(song?.phase)
              : t.perform.stageTitle}
          </h1>
          <p className="text-muted-foreground">
            {isTest
              ? t.perform.finalTestDesc(song?.title)
              : t.perform.stageDesc}
          </p>
        </div>
        {isTest && (
          <Badge className="bg-primary text-lg py-2 px-4 animate-pulse">
            {t.perform.finalTestBadge}
          </Badge>
        )}
      </div>

      {/* mic placement reminder banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">{t.perform.important}</span> {t.perform.micWarning}
        </p>
      </div>

      {/* main grid: stage card (2/3) + side panel (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* stage card — height expands when recording */}
          <Card className="overflow-hidden" data-testid="card-stage">
            <div
              className={`relative ${state === "performing" ? "min-h-[600px]" : "h-96"} bg-gradient-to-b from-primary/20 via-primary/5 to-background flex flex-col items-center justify-center transition-all duration-500`}
              style={{
                // radial spotlight effect only active during performance
                backgroundImage:
                  state === "performing"
                    ? "radial-gradient(circle at center, hsl(var(--primary) / 0.15) 0%, transparent 70%), linear-gradient(to bottom, hsl(var(--primary) / 0.1), transparent)"
                    : undefined,
              }}
            >
              {/* idle: mic icon + song name + start button */}
              {state === "idle" && (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mic className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {song
                        ? t.perform.readyToSing(song.title)
                        : t.perform.readyToPerform}
                    </h2>
                    <p className="text-muted-foreground">
                      {song
                        ? t.perform.songSubtitle(song.artist, song.genre)
                        : t.perform.stepOnStage}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      size="lg"
                      onClick={handleStartPerformance}
                      data-testid="button-start-performance"
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      {t.perform.takeStage}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handlePlayReferencePitch}
                      className="bg-background/50 hover:bg-background/80"
                      title="Play starting reference pitch"
                    >
                      <Volume2 className="h-5 w-5 mr-2" />
                      Reference Pitch
                    </Button>
                  </div>
                </div>
              )}

              {/* performing: live controls + lyric teleprompter */}
              {state === "performing" && (
                <div className="w-full h-full flex flex-col p-6 space-y-6">
                  {/* Top Controls Area */}
                  <div className="w-full max-w-2xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 bg-background/40 backdrop-blur-md p-4 rounded-xl border border-muted-foreground/20 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center md:items-start">
                        {/* recording timer */}
                        <div className="text-4xl font-mono tabular-nums font-bold text-primary">
                          {formatTime(duration)}
                        </div>
                        {/* live pitch detection: note name + Hz */}
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300 mt-1">
                          <div className="text-lg font-bold">
                            {currentNote || "--"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pitch ? `${Math.round(pitch)} Hz` : "Listening..."}
                          </div>
                        </div>

                        {/* Volume Level Indicator - Shows mic input level in real-time */}
                        <div className="mt-3 w-40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {t.perform.micLevel}
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                levelWarning === "too-quiet"
                                  ? "text-red-500"
                                  : levelWarning === "too-loud"
                                    ? "text-orange-500"
                                    : "text-green-500"
                              }`}
                            >
                              {levelWarning === "too-quiet"
                                ? t.perform.tooQuiet
                                : levelWarning === "too-loud"
                                  ? t.perform.tooLoud
                                  : t.perform.goodLevel}
                            </span>
                          </div>
                          {/* volume bar width reflects real-time mic input level */}
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-100 ${
                                levelWarning === "too-quiet"
                                  ? "bg-red-500"
                                  : levelWarning === "too-loud"
                                    ? "bg-orange-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(volumeLevel, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* live waveform — hidden on small screens */}
                      <div className="hidden sm:block">
                        <WaveformVisualizer
                          analyserData={analyserData}
                          isRecording={isRecording}
                          className="w-32 h-12 opacity-80"
                        />
                      </div>
                    </div>

                    {/* stop button ends recording and triggers analysis */}
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleStopPerformance}
                      data-testid="button-stop-performance"
                      className="w-full md:w-auto shadow-lg shadow-red-500/20"
                    >
                      <Square className="h-5 w-5 mr-2" />
                      {t.perform.endPerformance}
                    </Button>
                  </div>

                  {/* Passaggio Navigator — live pitch zone tracker */}
                  <div className="w-full max-w-2xl mx-auto">
                    <PassaggioNavigator
                      pitch={pitch}
                      voiceType={user?.vocalRange || "default"}
                      mode="live"
                      className="w-full"
                    />
                  </div>

                  {/* Lyrics Area */}
                  <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[300px]">
                    {song?.lyrics ? (
                      <div className="max-w-xl w-full bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/10 overflow-y-auto max-h-[400px] text-center shadow-2xl scrollbar-hide">
                        {song.lyricsTimestamps ? (
                          <div className="space-y-6 py-10">
                            {song.lyricsTimestamps.map((line, idx) => {
                              // active = current line; past = already sung; future = faded
                              const isActive =
                                duration >= line.time &&
                                (!song.lyricsTimestamps[idx + 1] ||
                                  duration <
                                    song.lyricsTimestamps[idx + 1].time);
                              const isPast = duration >= line.time && !isActive;

                              return (
                                <p
                                  key={idx}
                                  // attach ref to active line so useEffect can scroll to it
                                  ref={isActive ? activeLyricRef : null}
                                  className={`text-2xl md:text-3xl font-bold transition-all duration-500 transform ${
                                    isActive
                                      ? "text-primary scale-110 drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                                      : isPast
                                        ? "text-white/60 scale-100"
                                        : "text-white/20 scale-95"
                                  }`}
                                >
                                  {line.text}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          // fallback: show plain lyrics if no timestamps provided
                          <pre className="whitespace-pre-wrap font-sans text-xl md:text-2xl font-bold leading-relaxed text-white drop-shadow-sm">
                            {song.lyrics}
                          </pre>
                        )}
                      </div>
                    ) : (
                      // no lyrics: show pulsing mic icon instead
                      <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center mx-auto animate-pulse">
                        <Mic className="h-12 w-12 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* analyzing: spinner while AI processes the recording */}
              {state === "analyzing" && (
                <div className="text-center space-y-6">
                  <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t.perform.analyzingTitle}
                    </h2>
                    <p className="text-muted-foreground">
                      {t.perform.analyzingDesc}
                    </p>
                  </div>
                </div>
              )}

              {/* results: applause icons + reaction badges + feedback text */}
              {state === "results" && audienceReaction && (
                <div className="text-center space-y-4 p-6">
                  {/* render N icons based on applause level (1–4) */}
                  <div className="flex items-center justify-center gap-1">
                    {Array.from({
                      length: getApplauseEmoji(audienceReaction.applauseLevel)
                        .count,
                    }).map((_, i) => {
                      const Icon = getApplauseEmoji(
                        audienceReaction.applauseLevel,
                      ).icon;
                      return (
                        <Icon
                          key={i}
                          className="h-8 w-8 text-yellow-500 animate-bounce"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      );
                    })}
                  </div>
                  {/* audience reaction tags */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {audienceReaction.reactions.map((reaction, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {reaction}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {audienceReaction.feedback}
                  </p>
                </div>
              )}
            </div>

            {/* results footer: playback + retry button */}
            {state === "results" && audioUrl && (
              <CardContent className="p-6 border-t space-y-6">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-semibold">{t.perform.audienceReaction}</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleReset}
                      className="h-8 text-muted-foreground"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t.perform.retry}
                    </Button>
                    {/* replace underscores for readable label e.g. "standing ovation" */}
                    <Badge variant="outline" className="capitalize">
                      {audienceReaction?.applauseLevel.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                {/* playback of the user's recorded audio */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t.perform.yourRecording}</h4>
                  <AudioPlayer audioUrl={audioUrl} duration={duration} />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleReset}
                  data-testid="button-perform-again"
                >
                  {t.perform.performAgain}
                </Button>
              </CardContent>
            )}
          </Card>
        </div>

        {/* right side panel */}
        <div className="space-y-6">
          {/* phase complete banner — only if final test passed with score >= 70 */}
          {state === "results" &&
            isTest &&
            analysisResult &&
            analysisResult.overallRating >= 70 && (
              <Card className="border-primary bg-primary/5 animate-in fade-in zoom-in duration-500">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{t.perform.phaseComplete}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t.perform.phaseUnlocked(Number(song?.phase) + 1)}
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20"
                    onClick={() =>
                      router.push(`/phase/${Number(song?.phase) + 1}`)
                    }
                  >
                    {t.perform.goToPhase(Number(song?.phase) + 1)}
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* score breakdown card — shown after any performance */}
          {state === "results" && analysisResult && (
            <Card data-testid="card-performance-score">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  {t.perform.performanceScore}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreDisplay
                  pitchScore={analysisResult.pitchAccuracy}
                  toneScore={analysisResult.toneStability}
                  breathingScore={analysisResult.breathingConsistency}
                  vibratoScore={analysisResult.vibratoScore}
                  expressionScore={analysisResult.expressionScore}
                  ornamentScore={analysisResult.ornamentScore}
                  overallScore={analysisResult.overallRating}
                />
              </CardContent>
            </Card>
          )}

          {/* Passaggio breakdown — post-analysis zone distribution */}
          {state === "results" && analysisResult?.f0Contour?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Register Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PassaggioNavigator
                  f0Contour={analysisResult.f0Contour}
                  voiceType={user?.vocalRange || "default"}
                  mode="analysis"
                  className="w-full"
                />
              </CardContent>
            </Card>
          )}

          {/* tips card — only visible before performance starts */}
          {state === "idle" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  {t.perform.performanceTips}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {t.perform.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
