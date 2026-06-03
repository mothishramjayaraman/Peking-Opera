"use client";

import { Music, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context.jsx";
import { getSongDisplay } from "@/lib/song-translations.js";

const ROLE_META = {
  "旦角": { color: "#f472b6", bg: "#f472b614" },
  "老旦": { color: "#f472b6", bg: "#f472b614" },
  "生角": { color: "#60a5fa", bg: "#60a5fa14" },
  "老生": { color: "#34d399", bg: "#34d39914" },
  "小生": { color: "#60a5fa", bg: "#60a5fa14" },
  "净角": { color: "#c084fc", bg: "#c084fc14" },
  "花脸": { color: "#c084fc", bg: "#c084fc14" },
  "丑角": { color: "#fbbf24", bg: "#fbbf2414" },
};

const DIFF_META = {
  easy:   { label: "easy",   color: "#34d399", bg: "#34d39918" },
  medium: { label: "medium", color: "#fbbf24", bg: "#fbbf2418" },
  hard:   { label: "hard",   color: "#fb7185", bg: "#fb718518" },
};

export function SongCard({ song, onSelect }) {
  const { lang } = useLanguage();
  const display = getSongDisplay(song, lang);
  const roleKey = Object.keys(ROLE_META).find((k) => song.vocalRange?.includes(k));
  const role = roleKey ? ROLE_META[roleKey] : { color: "#60a5fa", bg: "#60a5fa14" };
  const roleLabel = roleKey ?? song.vocalRange;
  const diff = DIFF_META[song.difficulty] ?? DIFF_META.easy;

  return (
    <div
      className="group cursor-pointer rounded-2xl p-px overflow-hidden transition-all duration-250 hover:scale-[1.018]"
      style={{
        background: `linear-gradient(135deg, ${role.color}45, ${role.color}12, ${diff.color}20)`,
        boxShadow: `0 2px 10px ${role.color}14`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 22px ${role.color}32, 0 2px 8px ${role.color}16`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 2px 10px ${role.color}14`)}
      onClick={() => onSelect(song)}
      data-testid={`card-song-${song.id}`}
    >
      <div className="rounded-[15px] bg-card p-4 space-y-3">
        {/* title + difficulty */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${role.color}1e`, boxShadow: `0 0 12px ${role.color}22` }}
            >
              <Music className="h-5 w-5" style={{ color: role.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate">{display.title}</h3>
              <p className="text-xs text-muted-foreground/65 truncate mt-0.5">{display.artist}</p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.color}38` }}
          >
            {diff.label}
          </span>
        </div>

        {/* meta row */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground/65">
          <span className="font-semibold text-muted-foreground/80">{song.genre}</span>
          <span className="text-muted-foreground/25">·</span>
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3" />{song.bpm} BPM
          </span>
          <span className="text-muted-foreground/25">·</span>
          <span className="flex items-center gap-1">
            <Music className="h-3 w-3" />{song.key}
          </span>
          {song.lyrics && (
            <>
              <span className="text-muted-foreground/25">·</span>
              <span
                className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: "#60a5fa", background: "#60a5fa14", border: "1px solid #60a5fa28" }}
              >
                LYRICS
              </span>
            </>
          )}
        </div>

        {/* role badge */}
        {roleLabel && (
          <span
            className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold"
            style={{ color: role.color, background: role.bg, border: `1px solid ${role.color}38` }}
          >
            {roleLabel}
          </span>
        )}
      </div>
    </div>
  );
}
