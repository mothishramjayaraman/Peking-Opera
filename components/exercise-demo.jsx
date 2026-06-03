"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, ChevronLeft, ChevronRight, RefreshCw,
  Wind, Music, Activity, MessageSquare, User, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function parseSteps(instructions) {
  if (!instructions) return [];
  return instructions.split("\n").filter(Boolean).map((line, i) => ({
    number: i + 1,
    text: line.replace(/^\d+\.\s*/, "").trim(),
  }));
}

const TYPE_META = {
  breathing:    { label: "Breath Support",  Icon: Wind,          cls: "text-sky-300",     bg: "bg-sky-500/12",     border: "border-sky-400/35",    glow: "#38bdf8" },
  pitch:        { label: "Pitch Training",  Icon: Music,         cls: "text-violet-300",  bg: "bg-violet-500/12",  border: "border-violet-400/35", glow: "#a78bfa" },
  vibrato:      { label: "Vibrato",         Icon: Activity,      cls: "text-rose-300",    bg: "bg-rose-500/12",    border: "border-rose-400/35",   glow: "#fb7185" },
  articulation: { label: "Articulation",    Icon: MessageSquare, cls: "text-amber-300",   bg: "bg-amber-500/12",   border: "border-amber-400/35",  glow: "#fbbf24" },
  posture:      { label: "Posture",         Icon: User,          cls: "text-emerald-300", bg: "bg-emerald-500/12", border: "border-emerald-400/35",glow: "#34d399" },
  resonance:    { label: "Resonance",       Icon: Headphones,    cls: "text-purple-300",  bg: "bg-purple-500/12",  border: "border-purple-400/35", glow: "#c084fc" },
  general:      { label: "Vocal Technique", Icon: Music,         cls: "text-blue-300",    bg: "bg-blue-500/12",    border: "border-blue-400/35",   glow: "#60a5fa" },
};

function detectStepType(text) {
  const t = text.toLowerCase();
  if (/breath|inhale|exhale|abdomen|dantian|expand|lung|belly|气息|丹田/.test(t)) return "breathing";
  if (/pitch|scale|note|ascending|descend|pentatonic|half step|semitone|五声|音阶|1-2-3|6-5-3/.test(t)) return "pitch";
  if (/vibrat|vibrato|oscillat|warble|颤音/.test(t)) return "vibrato";
  if (/consonant|vowel|tongue|lip|articul|syllable|attack|flick|咬字|归韵/.test(t)) return "articulation";
  if (/stand|stance|feet|shoulder|posture|position|knees|手|站/.test(t)) return "posture";
  if (/hum|nasal|forehead|resonan|placement|forward|共鸣|头腔|鼻腔/.test(t)) return "resonance";
  return "general";
}

/* ─── BreathingVisual ────────────────────────────────────────────────────── */
function BreathingVisual({ active }) {
  const [phase, setPhase] = useState("rest");
  const [expanded, setExpanded] = useState(false);

  const CFG = {
    inhale: { label: "INHALE",  tip: "Expand lower abdomen outward",        color: "#38bdf8", dur: "4s" },
    hold:   { label: "HOLD",    tip: "Feel energy gather at 丹田",           color: "#818cf8", dur: "0.5s" },
    exhale: { label: "EXHALE",  tip: "Release slow and steady through lips", color: "#34d399", dur: "4s" },
    rest:   { label: "READY",   tip: "Take a comfortable starting position", color: "#64748b", dur: "0.4s" },
  };

  useEffect(() => {
    if (!active) { setPhase("rest"); setExpanded(false); return; }
    const ts = [];
    const go = () => {
      setPhase("inhale"); setExpanded(true);
      ts.push(setTimeout(() => {
        setPhase("hold");
        ts.push(setTimeout(() => {
          setPhase("exhale"); setExpanded(false);
          ts.push(setTimeout(() => {
            setPhase("rest");
            ts.push(setTimeout(() => { ts.length = 0; go(); }, 500));
          }, 4000));
        }, 900));
      }, 4000));
    };
    go();
    return () => ts.forEach(clearTimeout);
  }, [active]);

  const c = CFG[phase];
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";

  const ring = (base, alpha) => ({
    position: "absolute",
    width:  expanded ? base       : base * 0.28,
    height: expanded ? base       : base * 0.28,
    borderRadius: "50%",
    border: `1.5px solid ${c.color}${alpha}`,
    transition: `width ${c.dur} ${ease}, height ${c.dur} ${ease}, border-color 0.6s`,
  });

  return (
    <div className="flex flex-col items-center justify-center h-72 gap-3 select-none relative overflow-hidden">
      {/* ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${c.color}18 0%, transparent 68%)`,
          transition: `background ${c.dur} ${ease}`,
        }}
      />

      {/* concentric rings */}
      <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
        <div style={ring(210, "22")} />
        <div style={ring(168, "38")} />
        <div style={ring(124, "55")} />

        {/* glowing core orb */}
        <div
          className="relative z-10 flex items-center justify-center rounded-full"
          style={{
            width:  expanded ? 84 : 42,
            height: expanded ? 84 : 42,
            background: `radial-gradient(circle, ${c.color}ee 0%, ${c.color}88 100%)`,
            boxShadow: `0 0 ${expanded ? 38 : 12}px ${c.color}70, 0 0 ${expanded ? 70 : 20}px ${c.color}30`,
            transition: `all ${c.dur} ${ease}`,
          }}
        >
          <Wind
            style={{
              width:  expanded ? 28 : 15,
              height: expanded ? 28 : 15,
              color: "white",
              transition: `all ${c.dur} ${ease}`,
            }}
          />
        </div>
      </div>

      {/* phase label — large + clear */}
      <div className="text-center -mt-3 space-y-1">
        <p
          className="text-[2rem] font-black tracking-[0.32em]"
          style={{ color: c.color, transition: "color 0.5s, text-shadow 0.5s", textShadow: `0 0 24px ${c.color}60` }}
        >
          {c.label}
        </p>
        <p className="text-xs text-muted-foreground tracking-wide">{c.tip}</p>
      </div>
    </div>
  );
}

/* ─── PitchVisual ─────────────────────────────────────────────────────────── */
function PitchVisual({ active }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  const notes = [
    { label: "Do",  zh: "宫", color: "#60a5fa", sy: 4 },
    { label: "Re",  zh: "商", color: "#818cf8", sy: 3 },
    { label: "Mi",  zh: "角", color: "#c084fc", sy: 2 },
    { label: "Sol", zh: "徵", color: "#f472b6", sy: 1 },
    { label: "La",  zh: "羽", color: "#fb7185", sy: 0 },
  ];

  useEffect(() => {
    if (!active) { setIdx(0); return; }
    let i = 0, d = 1;
    const iv = setInterval(() => {
      setIdx(i); setDir(d);
      i += d;
      if (i >= notes.length)  { i = notes.length - 2; d = -1; }
      if (i < 0)              { i = 1;                d = 1;  }
    }, 550);
    return () => clearInterval(iv);
  }, [active]);

  const W = 284, staffTop = 28, sp = 24, NR = 13;
  const staffLines = [0, 1, 2, 3, 4].map(i => staffTop + i * sp);
  const noteX = (i) => 36 + i * 52;
  const noteY = (n) => staffTop + n.sy * sp;
  const cur = notes[idx];

  return (
    <div className="flex flex-col items-center justify-center h-72 gap-0">
      {/* big current note name */}
      <div className="relative mb-1" style={{ height: 56, width: 200 }}>
        {notes.map((n, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center justify-center gap-2"
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? "translateY(0) scale(1)" : "translateY(10px) scale(0.85)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
              pointerEvents: "none",
            }}
          >
            <span className="text-4xl font-black" style={{ color: n.color, textShadow: `0 0 20px ${n.color}80` }}>
              {n.label}
            </span>
            <span className="text-xl font-bold" style={{ color: n.color + "99" }}>{n.zh}</span>
          </div>
        ))}
      </div>

      {/* staff + note SVG */}
      <svg width={W} height={148} viewBox={`0 0 ${W} 148`}>
        {/* staff lines */}
        {staffLines.map((y, i) => (
          <line key={i} x1={16} y1={y} x2={W - 16} y2={y}
            stroke="hsl(var(--muted-foreground)/0.18)" strokeWidth={1} />
        ))}

        {/* connector line segments */}
        {notes.map((n, i) => {
          if (i === 0) return null;
          const prev = notes[i - 1];
          const lit = i === idx || i - 1 === idx;
          return (
            <line key={`seg${i}`}
              x1={noteX(i - 1)} y1={noteY(prev)}
              x2={noteX(i)} y2={noteY(n)}
              stroke={lit ? (i === idx ? n.color : prev.color) + "55" : "transparent"}
              strokeWidth={2.5} strokeLinecap="round"
              style={{ transition: "stroke 0.3s" }}
            />
          );
        })}

        {/* note circles */}
        {notes.map((n, i) => {
          const x = noteX(i), y = noteY(n);
          const isActive = i === idx;
          return (
            <g key={i}>
              {isActive && (
                <circle cx={x} cy={y} r={NR + 12} fill={n.color} opacity={0.14}
                  style={{ animation: "demo-glow 1s ease-in-out infinite" }} />
              )}
              <circle
                cx={x} cy={y}
                r={isActive ? NR : NR - 4}
                fill={isActive ? n.color : "hsl(var(--muted-foreground)/0.12)"}
                stroke={isActive ? n.color : "hsl(var(--muted-foreground)/0.28)"}
                strokeWidth={2}
                style={{ transition: "r 0.3s, fill 0.3s, stroke 0.3s", animation: isActive ? "demo-note-bounce 0.45s ease-in-out" : "none" }}
              />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize={isActive ? "9" : "8"} fontWeight="bold"
                fill={isActive ? "white" : "hsl(var(--muted-foreground)/0.35)"}
                style={{ transition: "font-size 0.3s, fill 0.3s" }}>
                {n.zh}
              </text>
            </g>
          );
        })}

        {/* direction label */}
        <text x={W / 2} y={140} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground)/0.45)">
          {dir > 0 ? "↑ ascending" : "↓ descending"}
        </text>
      </svg>
    </div>
  );
}

/* ─── VibratoVisual ───────────────────────────────────────────────────────── */
function VibratoVisual({ active }) {
  const waveRef  = useRef(null);
  const dotRef   = useRef(null);
  const frameRef = useRef(null);
  const tRef     = useRef(0);
  const W = 220, H = 56, AMP = 19, FREQ = 3.4;

  const buildPts = (t) =>
    Array.from({ length: 60 }, (_, i) => {
      const x = (i / 59) * W;
      const y = H / 2 + AMP * Math.sin((i / 59) * Math.PI * 2 * FREQ + t);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(frameRef.current);
      waveRef.current?.setAttribute("points", buildPts(0));
      if (dotRef.current) { dotRef.current.setAttribute("cx", "0"); dotRef.current.setAttribute("cy", `${H / 2}`); }
      tRef.current = 0;
      return;
    }
    const tick = () => {
      tRef.current += 0.052;
      const t = tRef.current;
      waveRef.current?.setAttribute("points", buildPts(t));
      const px = ((t * 20) % W + W) % W;
      const py = H / 2 + AMP * Math.sin((px / W) * Math.PI * 2 * FREQ + t);
      dotRef.current?.setAttribute("cx", px.toFixed(1));
      dotRef.current?.setAttribute("cy", py.toFixed(1));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <div className="flex flex-col items-center justify-center h-72 gap-6 px-2">
      {/* straight reference */}
      <div className="flex items-center gap-4 w-full max-w-sm">
        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest w-16 text-right shrink-0">
          Straight
        </span>
        <div className="relative flex-1 flex items-center" style={{ height: H + 4 }}>
          <div className="w-full h-px bg-muted-foreground/25 rounded-full" />
          <div className="absolute right-0 w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
        </div>
      </div>

      {/* vibrato wave */}
      <div className="flex items-center gap-4 w-full max-w-sm">
        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest w-16 text-right shrink-0">
          Vibrato
        </span>
        <div className="relative rounded-lg overflow-hidden flex-1" style={{ height: H + 4 }}>
          {/* amplitude zone */}
          <div
            className="absolute inset-x-0 rounded-lg bg-rose-400/8"
            style={{ top: (H + 4) / 2 - AMP, height: AMP * 2 }}
          />
          <svg width="100%" height={H + 4} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#fb7185" />
                <stop offset="50%"  stopColor="#f472b6" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>
            <line x1={0} y1={H / 2} x2={W} y2={H / 2}
              stroke="hsl(var(--muted-foreground)/0.08)" strokeWidth={1} strokeDasharray="3 3" />
            <polyline ref={waveRef} points={buildPts(0)}
              fill="none" stroke="url(#waveGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle ref={dotRef} cx={0} cy={H / 2} r={5.5}
              fill="white" stroke="#fb7185" strokeWidth="2.5" />
          </svg>
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center gap-2 max-w-sm w-full pl-20">
        <div className="flex-1 h-px bg-muted-foreground/15" />
        <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">± 0.5 semitone oscillation</span>
        <div className="flex-1 h-px bg-muted-foreground/15" />
      </div>
    </div>
  );
}

/* ─── ArticulationVisual ─────────────────────────────────────────────────── */
function ArticulationVisual({ active }) {
  const [stage, setStage] = useState(0);
  const [vowelPct, setVowelPct] = useState(0);

  useEffect(() => {
    if (!active) { setStage(0); setVowelPct(0); return; }
    const ts = []; let iv = null;
    const cycle = () => {
      setStage(1); setVowelPct(0);
      ts.push(setTimeout(() => {
        setStage(2);
        let p = 0;
        iv = setInterval(() => {
          p += 1.8;
          setVowelPct(Math.min(p, 100));
          if (p >= 100) {
            clearInterval(iv);
            ts.push(setTimeout(() => { setStage(0); ts.push(setTimeout(cycle, 350)); }, 220));
          }
        }, 28);
      }, 320));
    };
    cycle();
    return () => { ts.forEach(clearTimeout); clearInterval(iv); };
  }, [active]);

  return (
    <div className="flex flex-col items-center justify-center h-72 gap-5 px-4">
      {/* stage display */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        {/* consonant block */}
        <div className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 p-3 min-w-[64px] transition-all duration-200",
          stage === 1
            ? "border-amber-400 bg-amber-400/18 scale-110 shadow-xl shadow-amber-400/25"
            : "border-muted-foreground/18 bg-muted/20"
        )}>
          <span className={cn("text-3xl font-black leading-none", stage === 1 ? "text-amber-300" : "text-muted-foreground/30")}>T</span>
          <span className={cn("text-[9px] mt-1 font-semibold tracking-wide", stage === 1 ? "text-amber-400/80" : "text-muted-foreground/25")}>咬字</span>
        </div>

        <div className={cn("text-xl font-bold transition-all duration-200", stage >= 1 ? "text-primary" : "text-muted-foreground/15")}>→</div>

        {/* vowel block */}
        <div className={cn(
          "flex-1 flex flex-col items-center justify-center rounded-full border-2 py-3 transition-all duration-300",
          stage === 2
            ? "border-sky-400 bg-sky-400/14 scale-105 shadow-xl shadow-sky-400/20"
            : "border-muted-foreground/18 bg-muted/20"
        )}>
          <span className={cn("text-2xl font-bold leading-none", stage === 2 ? "text-sky-300" : "text-muted-foreground/30")}>iān</span>
          <span className={cn("text-[9px] mt-1 font-semibold tracking-wide", stage === 2 ? "text-sky-400/80" : "text-muted-foreground/25")}>归韵</span>
        </div>

        {/* result character */}
        <div className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 p-3 min-w-[56px] transition-all duration-500",
          stage === 2 && vowelPct > 70
            ? "border-emerald-400 bg-emerald-400/14 shadow-lg shadow-emerald-400/20"
            : "border-muted-foreground/10"
        )}>
          <span className={cn(
            "text-3xl font-bold leading-none transition-all duration-500",
            stage === 2 && vowelPct > 70 ? "text-emerald-300" : "text-muted-foreground/15"
          )}>天</span>
        </div>
      </div>

      {/* timeline bar */}
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-[10px] text-muted-foreground/50 font-medium">
          <span>attack 短</span>
          <span>sustain ───── 长</span>
          <span>resolve</span>
        </div>
        <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden flex">
          <div
            className={cn("h-full rounded-l-full transition-all duration-300",
              stage === 1 ? "bg-amber-400" : stage === 2 ? "bg-amber-400/45" : "bg-muted-foreground/15")}
            style={{ width: "12%" }}
          />
          <div className="flex-1 bg-muted-foreground/8 rounded-r-full overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-r-full"
              style={{ width: stage === 2 ? `${vowelPct}%` : "0%", transition: stage === 2 ? "none" : "width 0.3s" }}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-center font-medium">
        Sharp consonant attack → resonant vowel sustain
      </p>
    </div>
  );
}

/* ─── PostureVisual ───────────────────────────────────────────────────────── */
function PostureVisual({ active, stepText }) {
  const t = stepText.toLowerCase();
  const hiHead    = /head|nasal|forehead|eye|eyebrow|鼻|眉/.test(t);
  const hiChest   = /chest|胸/.test(t);
  const hiAbdomen = /abdomen|belly|dantian|lower|丹田/.test(t);
  const hiFeet    = /feet|foot|knee|stand|stance|站/.test(t);

  const label = hiAbdomen ? "丹田 — 2 fingers below navel"
              : hiHead    ? "Forward resonance — feel vibration at the eyebrows"
              : hiChest   ? "Chest resonance — rich, grounded tone"
              : hiFeet    ? "Shoulder-width stance, soft knees"
              :              "Classic opera starting position";

  const P = "hsl(var(--primary))";
  const M = "hsl(var(--muted-foreground)/0.28)";

  return (
    <div className="flex flex-col items-center justify-center h-72 gap-2">
      <div className="relative">
        <svg width={190} height={185} viewBox="0 0 190 185">
          {hiAbdomen && active && <ellipse cx={95} cy={108} rx={28} ry={17} fill={P} opacity={0.16} style={{ animation: "demo-glow 1.4s ease-in-out infinite" }} />}
          {hiHead    && active && <circle  cx={95} cy={23}  r={26}          fill={P} opacity={0.14} style={{ animation: "demo-glow 1.4s ease-in-out infinite" }} />}
          {hiChest   && active && <ellipse cx={95} cy={68}  rx={26} ry={22} fill={P} opacity={0.13} style={{ animation: "demo-glow 1.4s ease-in-out infinite" }} />}
          {hiFeet    && active && <>
            <ellipse cx={76}  cy={168} rx={14} ry={6} fill={P} opacity={0.16} style={{ animation: "demo-glow 1.4s ease-in-out infinite" }} />
            <ellipse cx={114} cy={168} rx={14} ry={6} fill={P} opacity={0.16} style={{ animation: "demo-glow 1.4s ease-in-out infinite" }} />
          </>}

          <circle cx={95} cy={23} r={16} fill={hiHead ? P : M} style={{ transition: "fill 0.5s" }} />
          <rect x={91} y={38} width={8} height={10} fill={M} />
          <rect x={70} y={48} width={50} height={40} rx={10} fill={hiChest ? P : M} style={{ transition: "fill 0.5s" }} />
          <rect x={72} y={84} width={46} height={30} rx={8} fill={hiAbdomen ? P : "hsl(var(--muted-foreground)/0.18)"} style={{ transition: "fill 0.5s" }} />
          {hiAbdomen && <circle cx={95} cy={108} r={5.5} fill="white" opacity={0.85} />}
          {hiAbdomen && <circle cx={95} cy={108} r={5.5} fill="none" stroke={P} strokeWidth={2} />}
          {hiAbdomen ? <>
            <path d={`M 70,56 Q 50,80 56,106`} stroke={P} strokeWidth={6} strokeLinecap="round" fill="none" />
            <path d={`M 120,56 Q 140,80 134,106`} stroke={P} strokeWidth={6} strokeLinecap="round" fill="none" />
          </> : <>
            <line x1={70} y1={56} x2={46} y2={90} stroke={M} strokeWidth={7} strokeLinecap="round" />
            <line x1={120} y1={56} x2={144} y2={90} stroke={M} strokeWidth={7} strokeLinecap="round" />
          </>}
          <line x1={84} y1={114} x2={76}  y2={160} stroke={hiFeet ? P : M} strokeWidth={7} strokeLinecap="round" style={{ transition: "stroke 0.5s" }} />
          <line x1={106} y1={114} x2={114} y2={160} stroke={hiFeet ? P : M} strokeWidth={7} strokeLinecap="round" style={{ transition: "stroke 0.5s" }} />
          <ellipse cx={74}  cy={165} rx={13} ry={5} fill={hiFeet ? P : M} style={{ transition: "fill 0.5s" }} />
          <ellipse cx={116} cy={165} rx={13} ry={5} fill={hiFeet ? P : M} style={{ transition: "fill 0.5s" }} />

          {hiAbdomen && <>
            <line x1={46} y1={108} x2={80} y2={108} stroke={P} strokeWidth={1.5} strokeDasharray="3 2.5" />
            <polygon points="82,108 76,104 76,112" fill={P} />
            <text x={8} y={112} fontSize={9.5} fill={P} fontWeight="bold">丹田</text>
          </>}
          {hiHead && <>
            <line x1={124} y1={23} x2={150} y2={23} stroke={P} strokeWidth={1.5} strokeDasharray="3 2.5" />
            <text x={153} y={27} fontSize={9.5} fill={P} fontWeight="bold">头腔</text>
          </>}
          {hiFeet && <>
            <line x1={76} y1={148} x2={54} y2={136} stroke={P} strokeWidth={1.5} strokeDasharray="3 2.5" />
            <text x={30} y={140} fontSize={9.5} fill={P} fontWeight="bold">稳</text>
          </>}
        </svg>
      </div>
      <p className="text-[11px] text-center text-muted-foreground/70 max-w-[210px] leading-relaxed">{label}</p>
    </div>
  );
}

/* ─── ResonanceVisual ─────────────────────────────────────────────────────── */
function ResonanceVisual({ active }) {
  const [zone, setZone] = useState(0);

  const zones = [
    { zh: "胸腔", en: "Chest",   color: "#60a5fa", cy: 132 },
    { zh: "咽腔", en: "Pharynx", color: "#818cf8", cy: 98  },
    { zh: "口腔", en: "Mouth",   color: "#c084fc", cy: 72  },
    { zh: "鼻腔", en: "Nasal",   color: "#f472b6", cy: 46  },
    { zh: "头腔", en: "Head",    color: "#fb7185", cy: 22  },
  ];

  useEffect(() => {
    if (!active) { setZone(0); return; }
    let i = 0;
    const iv = setInterval(() => { setZone(i % zones.length); i++; }, 780);
    return () => clearInterval(iv);
  }, [active]);

  const z = zones[zone];

  return (
    <div className="flex items-center justify-center h-72 gap-8">
      {/* silhouette + dots */}
      <div className="relative shrink-0" style={{ width: 76, height: 158 }}>
        <svg width={76} height={158} viewBox="0 0 76 158">
          <circle cx={38} cy={22} r={14} fill="hsl(var(--muted-foreground)/0.22)" />
          <rect x={34} y={35} width={8} height={10} fill="hsl(var(--muted-foreground)/0.18)" />
          <rect x={20} y={45} width={36} height={62} rx={10} fill="hsl(var(--muted-foreground)/0.18)" />
          {zones.map((z2, i) => (
            <g key={i}>
              {i === zone && (
                <circle cx={38} cy={z2.cy} r={16} fill={z2.color} opacity={0.14}
                  style={{ animation: "demo-ring-pop 0.65s ease-out" }} />
              )}
              <circle cx={38} cy={z2.cy}
                r={i === zone ? 7.5 : 5}
                fill={i <= zone ? z2.color : "transparent"}
                stroke={z2.color}
                strokeWidth={1.5}
                opacity={i === zone ? 1 : 0.28}
                style={{ transition: "r 0.3s, fill 0.4s, opacity 0.4s" }}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* label list */}
      <div className="flex flex-col gap-3">
        {zones.map((z2, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 transition-all duration-300"
            style={{
              opacity: i === zone ? 1 : 0.25,
              transform: i === zone ? "scale(1.08) translateX(4px)" : "scale(1)",
            }}
          >
            <div
              className="w-3 h-3 rounded-full shrink-0 transition-all duration-300"
              style={{
                backgroundColor: z2.color,
                boxShadow: i === zone ? `0 0 10px ${z2.color}80` : "none",
              }}
            />
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold" style={{ color: i === zone ? z2.color : undefined }}>{z2.zh}</span>
              <span className="text-[10px] text-muted-foreground">{z2.en}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── GeneralVisual ───────────────────────────────────────────────────────── */
function GeneralVisual({ active }) {
  return (
    <div className="flex flex-col items-center justify-center h-72 gap-4">
      <div className="relative flex items-center justify-center w-36 h-36">
        <div
          className={cn("absolute w-32 h-32 rounded-full border border-primary/18", active && "animate-spin")}
          style={{ animationDuration: "10s" }}
        />
        <div
          className={cn("absolute w-24 h-24 rounded-full border border-primary/12", active && "animate-spin")}
          style={{ animationDuration: "6s", animationDirection: "reverse" }}
        />
        {active && [0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full bg-primary/55"
            style={{
              animation: `demo-orbit ${3.5 + i * 0.8}s linear infinite`,
              animationDelay: `${i * 0.7}s`,
              transformOrigin: `${50 + i * 7}px center`,
            }}
          />
        ))}
        <div
          className={cn(
            "relative z-10 w-20 h-20 rounded-full bg-primary/12 border-2 border-primary/35 flex items-center justify-center",
            active && "animate-pulse"
          )}
          style={{ boxShadow: active ? "0 0 24px hsl(var(--primary)/0.25)" : "none" }}
        >
          <span className="text-4xl" style={{ animation: active ? "demo-float 3s ease-in-out infinite" : "none" }}>♪</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground/60 tracking-widest uppercase font-semibold">Vocal Technique</span>
    </div>
  );
}

/* ─── StepVisual wrapper ─────────────────────────────────────────────────── */
function StepVisual({ step, active }) {
  switch (detectStepType(step.text)) {
    case "breathing":    return <BreathingVisual active={active} />;
    case "pitch":        return <PitchVisual active={active} />;
    case "vibrato":      return <VibratoVisual active={active} />;
    case "articulation": return <ArticulationVisual active={active} />;
    case "posture":      return <PostureVisual active={active} stepText={step.text} />;
    case "resonance":    return <ResonanceVisual active={active} />;
    default:             return <GeneralVisual active={active} />;
  }
}

/* ─── Main export ─────────────────────────────────────────────────────────── */
export function ExerciseDemo({ exercise }) {
  const steps = parseSteps(exercise?.instructions);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const timerRef = useRef(null);
  const STEP_DURATION = 6000;

  const goNext = useCallback(() => {
    setCurrent((c) => {
      const next = c + 1;
      if (next >= steps.length) { setPlaying(false); return c; }
      setSlideDir(1);
      setProgressKey((k) => k + 1);
      return next;
    });
  }, [steps.length]);

  const goTo = useCallback((i, dir = 1) => {
    setSlideDir(dir);
    setCurrent(i);
    setPlaying(false);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (playing) timerRef.current = setInterval(goNext, STEP_DURATION);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [playing, goNext]);

  useEffect(() => { setCurrent(0); setPlaying(false); }, [exercise?.id]);

  if (!steps.length) return null;

  const step = steps[current];
  const type = detectStepType(step.text);
  const meta = TYPE_META[type];
  const MetaIcon = meta.Icon;

  return (
    <div className="space-y-3">
      {/* ── Gradient-border card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-px overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${meta.glow}50, ${meta.glow}10, ${meta.glow}30)` }}
      >
        <div className="rounded-[15px] overflow-hidden bg-card">

          {/* ── Header ─── */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border/20"
            style={{ background: `linear-gradient(90deg, ${meta.glow}18, transparent)` }}
          >
            {/* type badge */}
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs font-bold", meta.bg, meta.cls, meta.border)}>
              <MetaIcon className="h-3.5 w-3.5" />
              {meta.label}
            </div>

            {/* step dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i, i > current ? 1 : -1)}
                  className="rounded-full transition-all duration-250 hover:bg-primary/50"
                  style={{
                    width:  i === current ? 20 : 8,
                    height: 8,
                    background: i === current ? meta.glow : "hsl(var(--muted-foreground)/0.22)",
                    boxShadow: i === current ? `0 0 8px ${meta.glow}80` : "none",
                  }}
                />
              ))}
            </div>

            {/* step counter */}
            <span className="text-xs font-bold tabular-nums" style={{ color: meta.glow }}>
              {current + 1} / {steps.length}
            </span>
          </div>

          {/* ── Animated visual ─── */}
          <div
            key={`${current}-${slideDir}`}
            style={{ animation: `demo-slide-${slideDir > 0 ? "right" : "left"} 0.28s ease-out` }}
          >
            <StepVisual step={step} active={playing} />
          </div>

          {/* ── Progress bar ─── */}
          <div className="mx-4 mb-3 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            {playing ? (
              <div
                key={`pb-${progressKey}-${current}`}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${meta.glow}cc, ${meta.glow})`,
                  boxShadow: `0 0 6px ${meta.glow}60`,
                  animation: `exercise-demo-grow ${STEP_DURATION}ms linear forwards`,
                }}
              />
            ) : (
              <div className="h-full rounded-full w-full" style={{ background: `${meta.glow}25` }} />
            )}
          </div>

          {/* ── Step text card ─── */}
          <div className="px-4 pb-4">
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                background: `${meta.glow}0d`,
                borderColor: `${meta.glow}35`,
              }}
            >
              <p className="text-sm leading-relaxed">
                <span className="font-black text-base mr-2" style={{ color: meta.glow }}>
                  {current + 1}.
                </span>
                {step.text}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost" size="icon"
          onClick={() => goTo(Math.max(0, current - 1), -1)}
          disabled={current === 0}
          className="rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button
          className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95"
          style={{
            background: playing
              ? "hsl(var(--secondary))"
              : `linear-gradient(135deg, ${meta.glow}cc, ${meta.glow}99)`,
            boxShadow: playing ? "none" : `0 0 20px ${meta.glow}40, 0 4px 12px ${meta.glow}30`,
            color: playing ? "hsl(var(--secondary-foreground))" : "white",
            minWidth: 128,
            justifyContent: "center",
          }}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing
            ? <><Pause className="h-4 w-4" />Pause</>
            : <><Play  className="h-4 w-4" />Play Demo</>}
        </button>

        <Button
          variant="ghost" size="icon"
          onClick={() => goTo(Math.min(steps.length - 1, current + 1), 1)}
          disabled={current === steps.length - 1}
          className="rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" title="Restart" onClick={() => goTo(0, -1)} className="rounded-full">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Step list ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/25 overflow-hidden max-h-52 overflow-y-auto">
        {steps.map((s, i) => {
          const sType = detectStepType(s.text);
          const sMeta = TYPE_META[sType];
          const SIcon = sMeta.Icon;
          const isActive = i === current;
          return (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 1 : -1)}
              className={cn(
                "w-full text-left flex items-start gap-3 px-3.5 py-3 text-sm transition-all border-b border-border/15 last:border-0",
                isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
              style={{
                background: isActive ? `${sMeta.glow}10` : undefined,
                borderLeft: isActive ? `3px solid ${sMeta.glow}` : "3px solid transparent",
              }}
            >
              {/* icon badge */}
              <div
                className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: isActive ? `${sMeta.glow}22` : "hsl(var(--muted-foreground)/0.08)",
                }}
              >
                <SIcon
                  className="h-3 w-3"
                  style={{ color: isActive ? sMeta.glow : "hsl(var(--muted-foreground)/0.4)" }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className="font-bold text-xs mr-2"
                  style={{ color: isActive ? sMeta.glow : "hsl(var(--muted-foreground)/0.35)" }}
                >
                  {i + 1}.
                </span>
                <span className={isActive ? "font-medium" : ""}>{s.text}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes exercise-demo-grow {
          from { width: 0% }
          to   { width: 100% }
        }
        @keyframes demo-slide-right {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes demo-slide-left {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes demo-glow {
          0%, 100% { opacity: 0.1; }
          50%       { opacity: 0.32; }
        }
        @keyframes demo-ring-pop {
          0%   { transform: scale(1); opacity: 0.28; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes demo-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes demo-orbit {
          from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
        }
        @keyframes demo-note-bounce {
          0%   { transform: translateY(0); }
          35%  { transform: translateY(-8px); }
          65%  { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
