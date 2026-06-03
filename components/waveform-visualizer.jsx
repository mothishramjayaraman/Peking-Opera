"use client";

import { useEffect, useRef } from "react";

export function WaveformVisualizer({
  analyserData,
  isRecording,
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!analyserData || !isRecording) {
      ctx.fillStyle = "hsl(var(--muted))";
      const barWidth = 4;
      const gap = 2;
      const barCount = Math.floor(width / (barWidth + gap));
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = 4;
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
      return;
    }

    const barWidth = 4;
    const gap = 2;
    const barCount = Math.floor(width / (barWidth + gap));
    const step = Math.floor(analyserData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step;
      const value = analyserData[dataIndex] || 0;
      const barHeight = Math.max(4, (value / 255) * height * 0.8);
      
      const hue = 262;
      const saturation = 83;
      const lightness = 50 + (value / 255) * 20;
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }, [analyserData, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={80}
      className={`w-full ${className}`}
      data-testid="canvas-waveform"
    />
  );
}
