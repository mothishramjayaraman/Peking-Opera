"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mic, Square, Loader2, Music, ChevronRight, Info,
  AudioWaveform, BookOpen, Star, Sparkles, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAudioRecorder } from "@/hooks/use-audio-recorder.js";
import { PassaggioNavigator } from "@/components/passaggio-navigator.jsx";
import { WaveformVisualizer } from "@/components/waveform-visualizer.jsx";

// Hz to note name (for the range display)
function hzToNote(hz) {
  if (!hz || hz <= 0) return "–";
  const notes = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  const midi  = Math.round(12 * Math.log2(hz / 440) + 69);
  const note  = notes[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

// Map broad 行当 → zone key for PassaggioNavigator
const FACH_TO_ZONE = {
  dan:   "dan",
  sheng: "sheng",
  jing:  "jing",
  chou:  "chou",
};

const FACH_COLORS = {
  dan:   { bg: "from-pink-500/20 to-rose-500/10",      badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  sheng: { bg: "from-amber-500/20 to-yellow-500/10",   badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  jing:  { bg: "from-slate-500/20 to-zinc-500/10",     badge: "bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-300" },
  chou:  { bg: "from-emerald-500/20 to-green-500/10",  badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

function ConfidenceBar({ value }) {
  const color = value >= 75 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Classification confidence</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RangeBar({ minHz, maxHz, p25Hz, p75Hz, fach }) {
  // Display range centred on each 行当 tessitura
  const zoneKey = FACH_TO_ZONE[fach] || "default";
  const displays = {
    dan:     { lo: 220,  hi:  880 },
    sheng:   { lo:  98,  hi:  440 },
    jing:    { lo:  65,  hi:  261 },
    chou:    { lo:  98,  hi:  523 },
    default: { lo:  98,  hi:  880 },
  };
  const { lo, hi } = displays[zoneKey] || displays.default;

  function pct(hz) {
    const logLo = Math.log2(lo);
    const logHi = Math.log2(hi);
    const logHz = Math.log2(Math.max(hz, 1));
    return Math.max(0, Math.min(100, ((logHz - logLo) / (logHi - logLo)) * 100));
  }

  const leftPct  = pct(minHz  || lo);
  const rightPct = pct(maxHz  || hi);
  const iqrLeft  = pct(p25Hz  || minHz || lo);
  const iqrRight = pct(p75Hz  || maxHz || hi);

  return (
    <div className="space-y-2 px-1">
      <div className="relative h-8 bg-muted rounded-full overflow-hidden">
        {/* Full range bar */}
        <div
          className="absolute top-1 bottom-1 rounded-full bg-primary/30"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        {/* IQR (core tessitura) */}
        <div
          className="absolute top-0 bottom-0 rounded-full bg-primary/70"
          style={{ left: `${iqrLeft}%`, width: `${iqrRight - iqrLeft}%` }}
        />
        {/* Note labels at key positions */}
        {["C3","G3","C4","G4","C5","G5"].map(n => {
          const noteHz = { C3:130.81, G3:196, C4:261.63, G4:392, C5:523.25, G5:784 }[n];
          if (!noteHz || noteHz < lo || noteHz > hi) return null;
          return (
            <span
              key={n}
              className="absolute top-0 bottom-0 flex items-end text-[8px] text-muted-foreground pb-0.5"
              style={{ left: `${pct(noteHz)}%`, transform: "translateX(-50%)" }}
            >{n}</span>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{hzToNote(minHz)} ({Math.round(minHz)} Hz)</span>
        <span className="text-xs text-center text-primary font-medium">Your range</span>
        <span>{hzToNote(maxHz)} ({Math.round(maxHz)} Hz)</span>
      </div>
    </div>
  );
}

export default function FachClassifier() {
  const [recordState, setRecordState] = useState("idle"); // idle | recording | classifying | done
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const {
    isRecording, duration, audioBlob, analyserData, pitch,
    startRecording, stopRecording, resetRecording,
  } = useAudioRecorder();

  const { data: user } = useQuery({ queryKey: ["/api/user"] });

  const handleStart = async () => {
    setError(null);
    setResult(null);
    resetRecording();
    setRecordState("recording");
    await startRecording();
  };

  const handleStop = async () => {
    stopRecording();
    setRecordState("classifying");
  };

  // Triggered when audioBlob is ready after stopping
  useEffect(() => {
    if (recordState !== "classifying" || !audioBlob) return;

    const classify = async () => {
      try {
        const form = new FormData();
        form.append("audio", audioBlob, "fach_sample.wav");

        const res = await fetch("/api/fach-classify", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json()).message || "Classification failed");

        const data = await res.json();
        setResult(data);
        setRecordState("done");
      } catch (err) {
        setError(err.message);
        setRecordState("idle");
      }
    };

    classify();
  }, [audioBlob, recordState]);

  const handleReset = () => {
    resetRecording();
    setResult(null);
    setError(null);
    setRecordState("idle");
  };

  // Quick classify without recording (based on profile only)
  const handleClassifyProfile = async () => {
    setError(null);
    setResult(null);
    setRecordState("classifying");
    try {
      const form = new FormData(); // no audio
      const res = await fetch("/api/fach-classify", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).message || "Classification failed");
      setResult(await res.json());
      setRecordState("done");
    } catch (err) {
      setError(err.message);
      setRecordState("idle");
    }
  };

  const fachColor = FACH_COLORS[result?.fach] || FACH_COLORS.soprano;

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AudioWaveform className="h-6 w-6 text-primary" />
          Voice Profiler & Fach Classifier
        </h1>
        <p className="text-muted-foreground mt-1">
          Sing a 20–30 second sample from your lowest to highest comfortable note. The AI will classify your 京剧 行当 (role category) and recommend repertoire.
        </p>
      </div>

      {/* Tip banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-400/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>For best results, sing slowly from your lowest 大嗓 (natural voice) up through your 换声区 (register transition) into 小嗓 (head voice), then back down. Stay relaxed — don't force the extremes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: recording card */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Sample</CardTitle>
              <CardDescription>Record a 20–30 second scale through your full comfortable range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Idle */}
              {recordState === "idle" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleStart} size="lg">
                      <Mic className="h-4 w-4 mr-2" />
                      Record Sample
                    </Button>
                    <Button variant="outline" onClick={handleClassifyProfile} size="lg">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Use Profile Only
                    </Button>
                  </div>
                </div>
              )}

              {/* Recording */}
              {recordState === "recording" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-2xl font-mono font-bold tabular-nums text-primary">
                        {formatTime(duration)}
                      </span>
                      {pitch && (
                        <span className="text-sm text-muted-foreground">
                          {Math.round(pitch)} Hz
                        </span>
                      )}
                    </div>
                    <Button variant="destructive" onClick={handleStop}>
                      <Square className="h-4 w-4 mr-2" />
                      Stop & Analyse
                    </Button>
                  </div>

                  <WaveformVisualizer
                    analyserData={analyserData}
                    isRecording={isRecording}
                    className="w-full h-16"
                  />

                  {/* Live Passaggio Navigator during sample recording */}
                  <PassaggioNavigator
                    pitch={pitch}
                    voiceType={user?.vocalRange || "default"}
                    mode="live"
                    className="w-full"
                  />

                  <p className="text-xs text-muted-foreground text-center">
                    Sing slowly from 大嗓 (natural voice) up through your 换声区 into 小嗓. Watch the Navigator to see your register zones.
                  </p>
                </div>
              )}

              {/* Classifying spinner */}
              {recordState === "classifying" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-muted-foreground">Analysing your vocal profile…</p>
                </div>
              )}

              {/* Done — show pitch contour */}
              {recordState === "done" && result?.f0Contour?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Your vocal range sample:</p>
                  <PassaggioNavigator
                    f0Contour={result.f0Contour}
                    voiceType={result.fach || user?.vocalRange || "default"}
                    mode="analysis"
                    className="w-full"
                  />
                  <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Record Again
                  </Button>
                </div>
              )}

              {recordState === "done" && !result?.f0Contour?.length && (
                <Button variant="outline" size="sm" onClick={handleReset} className="w-full mt-2">
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Record Again
                </Button>
              )}

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Vocal range bar (shown after done) */}
          {result?.pitchData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Measured Vocal Range</CardTitle>
              </CardHeader>
              <CardContent>
                <RangeBar
                  minHz={result.pitchData.min_hz}
                  maxHz={result.pitchData.max_hz}
                  p25Hz={result.pitchData.p25_hz}
                  p75Hz={result.pitchData.p75_hz}
                  fach={result.fach}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Solid bar = core tessitura (IQR). Full bar = complete observed range.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: classification result */}
        <div className="lg:col-span-2 space-y-4">
          {!result && recordState !== "done" && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Music className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Your 京剧 行当 classification will appear here after recording.</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Fach identity card */}
              <Card className={`bg-gradient-to-br ${fachColor.bg} border-primary/20`}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">你的行当 Your 行当</p>
                      <h2 className="text-2xl font-bold capitalize">
                        {(result.subfach || result.fach || "").replace(/_/g, " ")}
                      </h2>
                    </div>
                    <Badge className={`capitalize text-sm shrink-0 ${fachColor.badge}`}>
                      {(result.fach || "").replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <ConfidenceBar value={result.confidence || 50} />

                  <p className="text-sm text-muted-foreground">{result.tessitura_description}</p>
                </CardContent>
              </Card>

              {/* Passaggio notes */}
              {result.passaggio_notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Your Passaggio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{result.passaggio_notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Signature arias */}
              {result.signature_arias?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Signature Arias for You
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.signature_arias.map((aria, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{aria}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Training focus */}
              {result.training_focus && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      京剧 Vocal Training
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.training_focus}</p>
                  </CardContent>
                </Card>
              )}

              {/* Next steps */}
              {result.next_steps?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Next Steps</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.next_steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
