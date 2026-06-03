"use client";

import { useRef, useEffect, useMemo } from "react";

// 京剧 vocal register zone boundaries (Hz) per 行当.
// lp = 低换声区 lower transition (大嗓 → mixed)
// up = 高换声区 upper transition (mixed → 小嗓/falsetto)
const VOICE_ZONES = {
  // 旦 Dan roles — female/falsetto, high tessitura
  dan:       { label: "旦 Dan",            displayMin: 220,  displayMax:  880, lp: [294, 330], up: [494, 554] },
  qingyi:    { label: "青衣 Qingyi",       displayMin: 220,  displayMax:  880, lp: [294, 330], up: [494, 554] },
  huadan:    { label: "花旦 Huadan",       displayMin: 261,  displayMax: 1046, lp: [330, 370], up: [554, 622] },
  wudan:     { label: "武旦 Wudan",        displayMin: 220,  displayMax:  880, lp: [294, 330], up: [494, 554] },
  laodan:    { label: "老旦 Laodan",       displayMin: 174,  displayMax:  698, lp: [220, 247], up: [370, 415] },
  daomadan:  { label: "刀马旦 Daomadan",   displayMin: 220,  displayMax:  932, lp: [294, 330], up: [523, 587] },

  // 生 Sheng roles — male, mid tessitura
  sheng:     { label: "生 Sheng",          displayMin:  98,  displayMax:  440, lp: [138, 165], up: [220, 261] },
  laosheng:  { label: "老生 Laosheng",     displayMin:  98,  displayMax:  392, lp: [138, 165], up: [220, 261] },
  xiaosheng: { label: "小生 Xiaosheng",    displayMin: 110,  displayMax:  494, lp: [147, 175], up: [247, 294] },
  wusheng:   { label: "武生 Wusheng",      displayMin:  98,  displayMax:  415, lp: [131, 156], up: [208, 247] },

  // 净 Jing roles — painted face, deep powerful 大嗓
  jing:      { label: "净 Jing",           displayMin:  65,  displayMax:  261, lp: [ 98, 117], up: [165, 196] },
  dahualian: { label: "大花脸 Da Hualian", displayMin:  65,  displayMax:  220, lp: [ 87, 104], up: [147, 175] },
  erhualian: { label: "二花脸 Er Hualian", displayMin:  82,  displayMax:  294, lp: [110, 131], up: [185, 220] },

  // 丑 Chou roles — clown, flexible mid range
  chou:      { label: "丑 Chou",           displayMin:  98,  displayMax:  523, lp: [165, 196], up: [294, 330] },
  wenchou:   { label: "文丑 Wenchou",      displayMin:  98,  displayMax:  523, lp: [165, 196], up: [294, 330] },
  wuchou:    { label: "武丑 Wuchou",       displayMin: 110,  displayMax:  587, lp: [175, 208], up: [311, 349] },

  // Generic fallback
  default:   { label: "声部",              displayMin:  98,  displayMax:  880, lp: [196, 261], up: [392, 494] },
};

// Reference note labels for Y-axis grid lines
const NOTE_GRID = [
  { hz: 82.41,   label: "E2" },
  { hz: 130.81,  label: "C3" },
  { hz: 196.00,  label: "G3" },
  { hz: 261.63,  label: "C4" },
  { hz: 329.63,  label: "E4" },
  { hz: 392.00,  label: "G4" },
  { hz: 523.25,  label: "C5" },
  { hz: 659.25,  label: "E5" },
  { hz: 783.99,  label: "G5" },
  { hz: 1046.50, label: "C6" },
];

// Map Hz → canvas Y coordinate (logarithmic — mirrors musical pitch perception)
function freqToY(hz, minHz, maxHz, height) {
  const logMin = Math.log2(minHz);
  const logMax = Math.log2(maxHz);
  const logHz  = Math.log2(Math.max(hz, 1));
  const t = (logHz - logMin) / (logMax - logMin);
  return height - t * height;
}

// Determine which zone a given Hz value falls in for a voice type config
function getZone(hz, zones) {
  if (!hz || hz === 0) return "unvoiced";
  const [lpLo, lpHi] = zones.lp;
  const [upLo, upHi] = zones.up;
  if (hz < lpLo)  return "chest";
  if (hz <= lpHi) return "lower_passaggio";
  if (hz < upLo)  return "middle";
  if (hz <= upHi) return "upper_passaggio";
  return "head";
}

const ZONE_COLORS = {
  chest:            "#22c55e",  // green
  lower_passaggio:  "#f59e0b",  // amber
  middle:           "#60a5fa",  // blue
  upper_passaggio:  "#f59e0b",  // amber
  head:             "#a78bfa",  // violet
  unvoiced:         "transparent",
};

const ZONE_BG = {
  chest:            "rgba(34,197,94,0.08)",
  lower_passaggio:  "rgba(245,158,11,0.15)",
  middle:           "rgba(96,165,250,0.08)",
  upper_passaggio:  "rgba(245,158,11,0.15)",
  head:             "rgba(167,139,250,0.10)",
};

/**
 * PassaggioNavigator
 *
 * Props:
 *   pitch       – number|null  real-time Hz from useAudioRecorder (live mode)
 *   f0Contour   – number[]     post-analysis contour (0 = unvoiced frame)
 *   voiceType   – string       key into VOICE_ZONES (defaults to "default")
 *   mode        – "live"|"analysis"
 *   className   – string
 */
export function PassaggioNavigator({ pitch, f0Contour = [], voiceType = "default", mode = "live", className = "" }) {
  const canvasRef  = useRef(null);
  const historyRef = useRef([]); // circular pitch buffer for live mode

  const zones = VOICE_ZONES[voiceType?.toLowerCase()] || VOICE_ZONES.default;
  const HISTORY_MAX = 180; // ~3s at 60fps

  // Accumulate live pitch history
  useEffect(() => {
    if (mode !== "live") return;
    if (pitch && pitch > 60 && pitch < 1400) {
      historyRef.current.push(pitch);
      if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift();
    } else {
      // push null gap so the line breaks on silence
      historyRef.current.push(null);
      if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift();
    }
  }, [pitch, mode]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;
    const PAD_LEFT = 36; // space for note labels
    const chartW   = W - PAD_LEFT;

    ctx.clearRect(0, 0, W, H);

    const { displayMin, displayMax, lp, up } = zones;

    // ── Background zone bands ──────────────────────────────────────────────
    const zoneRects = [
      { name: "head",           yTop: 0,                               yBot: freqToY(up[1], displayMin, displayMax, H) },
      { name: "upper_passaggio",yTop: freqToY(up[1], displayMin, displayMax, H), yBot: freqToY(up[0], displayMin, displayMax, H) },
      { name: "middle",         yTop: freqToY(up[0], displayMin, displayMax, H), yBot: freqToY(lp[1], displayMin, displayMax, H) },
      { name: "lower_passaggio",yTop: freqToY(lp[1], displayMin, displayMax, H), yBot: freqToY(lp[0], displayMin, displayMax, H) },
      { name: "chest",          yTop: freqToY(lp[0], displayMin, displayMax, H), yBot: H },
    ];

    for (const zr of zoneRects) {
      ctx.fillStyle = ZONE_BG[zr.name];
      ctx.fillRect(PAD_LEFT, zr.yTop, chartW, zr.yBot - zr.yTop);
    }

    // ── Zone label text ───────────────────────────────────────────────────
    const zoneLabels = [
      { name: "小嗓 (Jia Sang)",   y: (zoneRects[0].yTop + zoneRects[0].yBot) / 2, color: "#a78bfa" },
      { name: "高换声区",           y: (zoneRects[1].yTop + zoneRects[1].yBot) / 2, color: "#f59e0b" },
      { name: "中音区",             y: (zoneRects[2].yTop + zoneRects[2].yBot) / 2, color: "#60a5fa" },
      { name: "低换声区",           y: (zoneRects[3].yTop + zoneRects[3].yBot) / 2, color: "#f59e0b" },
      { name: "大嗓 (Da Sang)",    y: (zoneRects[4].yTop + zoneRects[4].yBot) / 2, color: "#22c55e" },
    ];
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    for (const lbl of zoneLabels) {
      const bandHeight = Math.abs(
        zoneRects.find(z => z.name === lbl.name.toLowerCase().replace(" ", "_"))?.yBot -
        zoneRects.find(z => z.name === lbl.name.toLowerCase().replace(" ", "_"))?.yTop || 0
      );
      if (bandHeight < 12) continue; // skip tiny bands
      ctx.fillStyle = lbl.color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(lbl.name, PAD_LEFT + 4, lbl.y + 3);
      ctx.globalAlpha = 1;
    }

    // ── Y-axis note grid lines ─────────────────────────────────────────────
    ctx.strokeStyle = "rgba(156,163,175,0.2)";
    ctx.lineWidth = 1;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";

    for (const note of NOTE_GRID) {
      if (note.hz < displayMin || note.hz > displayMax) continue;
      const y = freqToY(note.hz, displayMin, displayMax, H);
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(156,163,175,0.8)";
      ctx.fillText(note.label, PAD_LEFT - 2, y + 3);
    }

    // ── Pitch contour ──────────────────────────────────────────────────────
    const data = mode === "live" ? historyRef.current : f0Contour;
    if (!data || data.length === 0) return;

    const xStep = chartW / Math.max(data.length - 1, 1);

    ctx.lineWidth = 2.5;
    ctx.lineJoin  = "round";
    ctx.lineCap   = "round";

    let penDown = false;
    for (let i = 0; i < data.length; i++) {
      const hz = data[i];
      if (!hz || hz < displayMin * 0.5 || hz > displayMax * 2) {
        // gap — lift pen
        if (penDown) { ctx.stroke(); penDown = false; }
        continue;
      }

      const x = PAD_LEFT + i * xStep;
      const y = freqToY(hz, displayMin, displayMax, H);
      const zone = getZone(hz, zones);

      if (!penDown) {
        ctx.beginPath();
        ctx.strokeStyle = ZONE_COLORS[zone];
        ctx.moveTo(x, y);
        penDown = true;
      } else {
        // Switch color at zone boundary by closing and reopening path
        const prevHz   = data[i - 1];
        const prevZone = prevHz ? getZone(prevHz, zones) : zone;
        if (prevZone !== zone) {
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = ZONE_COLORS[zone];
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    if (penDown) ctx.stroke();

    // ── Live cursor dot ────────────────────────────────────────────────────
    if (mode === "live" && pitch && pitch > displayMin * 0.5 && pitch < displayMax * 2) {
      const curX = PAD_LEFT + (data.length - 1) * xStep;
      const curY = freqToY(pitch, displayMin, displayMax, H);
      const zone = getZone(pitch, zones);

      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fillStyle = ZONE_COLORS[zone];
      ctx.shadowColor = ZONE_COLORS[zone];
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [pitch, f0Contour, mode, zones]);

  // Compute zone ratio stats
  const zoneStats = useMemo(() => {
    const data = mode === "live" ? historyRef.current : f0Contour;
    if (!data || data.length === 0) return null;

    const counts = { chest: 0, lower_passaggio: 0, middle: 0, upper_passaggio: 0, head: 0 };
    let voiced = 0;
    for (const hz of data) {
      if (!hz || hz === 0) continue;
      voiced++;
      const zone = getZone(hz, zones);
      if (zone !== "unvoiced") counts[zone]++;
    }
    if (voiced === 0) return null;

    return {
      chest:      Math.round((counts.chest / voiced) * 100),
      passaggio:  Math.round(((counts.lower_passaggio + counts.upper_passaggio) / voiced) * 100),
      middle:     Math.round((counts.middle / voiced) * 100),
      head:       Math.round((counts.head / voiced) * 100),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, f0Contour, mode, zones]);

  return (
    <div className={`rounded-xl border border-muted bg-background/60 backdrop-blur p-3 space-y-2 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          换声区 Navigator
        </span>
        <span className="text-xs text-muted-foreground">{zones.label}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={520}
        height={180}
        className="w-full h-auto rounded-lg"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Zone percentage pills */}
      {zoneStats && (
        <div className="flex gap-2 flex-wrap px-1">
          {zoneStats.chest > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
              大嗓 {zoneStats.chest}%
            </span>
          )}
          {zoneStats.passaggio > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
              换声区 {zoneStats.passaggio}%
            </span>
          )}
          {zoneStats.middle > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
              中音区 {zoneStats.middle}%
            </span>
          )}
          {zoneStats.head > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
              小嗓 {zoneStats.head}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
