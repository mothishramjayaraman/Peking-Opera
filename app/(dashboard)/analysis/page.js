"use client";
import { useState, useRef } from "react";
import {
  Upload,
  FileAudio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCcw,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/score-display.jsx";
import { analyzeVoice } from "@/lib/mock-ai.js";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context.jsx";

export default function AnalysisPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);
  const router = useRouter();
  const { t } = useLanguage();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith("audio/")) {
        setFile(selectedFile);
        setStatus("idle");
        setErrorMessage("");
      } else {
        setErrorMessage(t.analysis.invalidFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("analyzing");
    try {
      const analysis = await analyzeVoice(file, "chinese_opera");
      setResults(analysis);
      setStatus("results");
    } catch (error) {
      console.error("Analysis failed:", error);
      setErrorMessage(error.message || t.analysis.invalidFile);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setResults(null);
    setStatus("idle");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      setFile(droppedFile);
      setStatus("idle");
      setErrorMessage("");
    } else {
      setErrorMessage(t.analysis.invalidFileDrop);
    }
  };

  return (
    <div className="container max-w-5xl py-10 px-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t.analysis.title}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t.analysis.subtitle}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className={cn("lg:col-span-7", status === "results" ? "lg:col-span-12" : "lg:col-span-7")}>
          <Card className="border-2 border-dashed border-muted-foreground/20 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              {status === "idle" || status === "error" || (status === "uploading" && !results) ? (
                <div
                  className="flex flex-col items-center justify-center py-20 px-10 cursor-pointer group transition-all"
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={handleFileChange}
                  />
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {file ? file.name : t.analysis.chooseFile}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    {t.analysis.dragDrop}
                  </p>

                  {errorMessage && (
                    <Badge variant="destructive" className="mt-4 flex items-center gap-1 py-1">
                      <AlertCircle className="h-3 w-3" />
                      {errorMessage}
                    </Badge>
                  )}

                  {file && status !== "analyzing" && (
                    <Button
                      className="mt-8 px-8 h-12 text-lg font-semibold shadow-lg shadow-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      {t.analysis.analyzeVoice}
                    </Button>
                  )}
                </div>
              ) : status === "analyzing" ? (
                <div className="flex flex-col items-center justify-center py-24 px-10 text-center animate-in fade-in zoom-in duration-500">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{t.analysis.analyzingTitle}</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {t.analysis.analyzingDesc}
                  </p>
                </div>
              ) : status === "results" && results ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-8 border-b bg-muted/30">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{t.analysis.analysisComplete}</h3>
                          <p className="text-muted-foreground">{t.analysis.resultsGenerated(new Date().toLocaleDateString())}</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={reset} className="h-10">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        {t.analysis.analyzeNewFile}
                      </Button>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 items-center">
                      <ScoreDisplay
                        pitchScore={results.pitchAccuracy}
                        toneScore={results.toneStability}
                        breathingScore={results.breathingConsistency}
                        vibratoScore={results.vibratoScore}
                        expressionScore={results.expressionScore}
                        ornamentScore={results.ornamentScore}
                        overallScore={results.overallRating}
                        className="p-4"
                      />

                      <div className="space-y-4">
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-6">
                            <h4 className="font-semibold flex items-center gap-2 mb-4">
                              <Sparkles className="h-4 w-4 text-primary" />
                              {t.analysis.expertInsights}
                            </h4>
                            <ul className="space-y-3">
                              {results.suggestions && results.suggestions.length > 0 ? (
                                results.suggestions.map((suggestion, i) => (
                                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span>{suggestion}</span>
                                  </li>
                                ))
                              ) : (
                                t.analysis.defaultSuggestions.map((s, i) => (
                                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span>{s}</span>
                                  </li>
                                ))
                              )}
                            </ul>
                          </CardContent>
                        </Card>

                        <Button className="w-full h-12 font-bold" onClick={() => router.push("/practice")}>
                          {t.analysis.openPractice}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {status !== "results" && (
          <div className="lg:col-span-5 space-y-6 animate-in slide-in-from-right-4 duration-700">
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  {t.analysis.howItWorks}
                </CardTitle>
                <CardDescription>
                  {t.analysis.howItWorksDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {t.analysis.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{step.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">{t.analysis.bestTips}</h4>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {t.analysis.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
