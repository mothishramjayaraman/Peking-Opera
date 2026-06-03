"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music, Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SongCard } from "@/components/song-card.jsx";
import { generateBackingTrack } from "@/lib/mock-ai.js";
import { useLanguage } from "@/lib/language-context.jsx";
import { getSongDisplay } from "@/lib/song-translations.js";

/* ── constants ─────────────────────────────────────────────────────────────── */

const ROLE_COLORS = {
  "旦角": "#f472b6", "老旦": "#f472b6",
  "生角": "#60a5fa", "老生": "#34d399", "小生": "#60a5fa",
  "净角": "#c084fc", "花脸": "#c084fc",
  "丑角": "#fbbf24",
};

// Fixed bar heights for the waveform — no Math.random() jitter
const BAR_HEIGHTS = [13, 25, 17, 29, 20, 26, 14, 23, 19, 28, 15, 22];

// Floating note decorations for the empty state
const FLOAT_NOTES = [
  { note: "♪", x: "12%",  y: "18%",  size: 28, dur: 4.2, delay: 0    },
  { note: "♩", x: "78%",  y: "12%",  size: 22, dur: 3.6, delay: 0.8  },
  { note: "♫", x: "55%",  y: "72%",  size: 32, dur: 5.0, delay: 1.4  },
  { note: "♬", x: "88%",  y: "58%",  size: 20, dur: 3.9, delay: 0.4  },
  { note: "♪", x: "28%",  y: "80%",  size: 18, dur: 4.6, delay: 2.1  },
  { note: "♩", x: "68%",  y: "30%",  size: 24, dur: 3.3, delay: 1.7  },
];

/* ── component ─────────────────────────────────────────────────────────────── */

export default function Songs() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [selectedSong, setSelectedSong] = useState(null);
  const [backingTrack, setBackingTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    const rawSrc = selectedSong?.vocalUrl || selectedSong?.audioUrl;
    const previewSrc = rawSrc?.startsWith("https://archive.org/")
      ? `/api/audio-proxy?url=${encodeURIComponent(rawSrc)}`
      : rawSrc;
    if (previewSrc) {
      const newAudio = new Audio(previewSrc);
      newAudio.ontimeupdate = () => setCurrentTime(newAudio.currentTime);
      newAudio.onended = () => { setIsPlaying(false); setCurrentTime(0); };
      setAudio(newAudio);
      return () => { newAudio.pause(); newAudio.src = ""; };
    }
  }, [selectedSong]);

  useEffect(() => {
    if (audio) {
      if (isPlaying) audio.play().catch((e) => console.error("Audio play failed", e));
      else           audio.pause();
    }
  }, [isPlaying, audio]);

  /* resolve localized display early so currentLyric can use translated timestamps */
  const selectedDisplay = selectedSong ? getSongDisplay(selectedSong, lang) : null;

  const currentLyric = selectedDisplay?.lyricsTimestamps?.reduce((prev, curr) => {
    if (currentTime >= curr.time) return curr.text;
    return prev;
  }, "");

  const { data: userData, isLoading: isLoadingUser } = useQuery({ queryKey: ["/api/user"] });
  const { data, isLoading } = useQuery({ queryKey: ["/api/songs"] });

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setBackingTrack(generateBackingTrack(song.genre, song.bpm, song.key));
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const genres = ["all", "京剧"];
  const difficulties = ["all", "easy", "medium", "hard"];

  const filteredSongs = data?.songs?.filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre =
      genreFilter === "all" || song.genre.toLowerCase() === genreFilter;
    const matchesDifficulty =
      difficultyFilter === "all" || song.difficulty === difficultyFilter;
    return matchesSearch && matchesGenre && matchesDifficulty;
  });

  if (isLoading || isLoadingUser) return <SongsSkeleton />;

  if (userData && userData.currentPhase < 2) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="h-8 w-8 text-muted-foreground">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">{t.songs.notAvailable}</h2>
        <p className="text-muted-foreground mb-4">{t.songs.notAvailableDesc}</p>
        <Button onClick={() => router.push("/dashboard")}>{t.songs.backToDashboard}</Button>
      </div>
    );
  }

  /* role color and localized display for selected song */
  const roleKey = selectedSong
    ? Object.keys(ROLE_COLORS).find((k) => selectedSong.vocalRange?.includes(k))
    : null;
  const roleColor = roleKey ? ROLE_COLORS[roleKey] : "#60a5fa";
  const roleLabel = roleKey ?? selectedSong?.vocalRange;

  return (
    <div className="p-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t.songs.title}</h1>
          <p className="text-muted-foreground">{t.songs.subtitle}</p>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.songs.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-songs"
          />
        </div>
        <div className="flex gap-2">
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-32" data-testid="select-genre">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t.songs.allGenres} />
            </SelectTrigger>
            <SelectContent>
              {genres.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre === "all" ? t.songs.allGenres : genre.charAt(0).toUpperCase() + genre.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-32" data-testid="select-difficulty">
              <SelectValue placeholder={t.songs.allLevels} />
            </SelectTrigger>
            <SelectContent>
              {difficulties.map((diff) => (
                <SelectItem key={diff} value={diff}>
                  {diff === "all" ? t.songs.allLevels : diff.charAt(0).toUpperCase() + diff.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left: song lists ── */}
        <div className="lg:col-span-2 space-y-6">
          {data?.recommendedSongs?.length > 0 && !searchQuery && genreFilter === "all" && difficultyFilter === "all" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t.songs.songsForYou}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {data.recommendedSongs.slice(0, 4).map((song) => (
                  <SongCard key={song.id} song={song} onSelect={handleSelectSong} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {searchQuery || genreFilter !== "all" || difficultyFilter !== "all"
                ? t.songs.searchResults
                : t.songs.allSongs}
            </h2>
            {filteredSongs && filteredSongs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredSongs.map((song) => (
                  <SongCard key={song.id} song={song} onSelect={handleSelectSong} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t.songs.noSongs}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ── Right: detail / empty ── */}
        <div className="space-y-4">
          {selectedSong && backingTrack ? (
            /* ─ Song detail card ─ */
            <div
              className="rounded-2xl p-px overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${roleColor}50, ${roleColor}14, ${roleColor}30)` }}
              data-testid="card-selected-song"
            >
              <div className="rounded-[15px] bg-card overflow-hidden">

                {/* gradient header */}
                <div
                  className="px-4 py-4"
                  style={{ background: `linear-gradient(135deg, ${roleColor}20, ${roleColor}06)` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Music className="h-3.5 w-3.5 shrink-0" style={{ color: roleColor }} />
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: roleColor }}
                        >
                          {t.songs.nowPlaying}
                        </span>
                      </div>
                      <h3 className="font-bold text-base leading-tight">{selectedDisplay.title}</h3>
                      <p className="text-sm text-muted-foreground/65 mt-0.5">{selectedDisplay.artist}</p>
                    </div>
                    {roleLabel && (
                      <span
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold mt-1"
                        style={{ color: roleColor, background: `${roleColor}1a`, border: `1px solid ${roleColor}38` }}
                      >
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* meta grid */}
                <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-border/20">
                  {[
                    { label: t.songs.genre,      value: selectedSong.genre },
                    { label: t.songs.key,        value: selectedSong.key },
                    { label: t.songs.bpm,        value: `${selectedSong.bpm} BPM` },
                    { label: t.songs.vocalRange, value: selectedSong.vocalRange },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground/45 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-4 space-y-4">
                  {/* lyrics */}
                  {selectedDisplay.lyrics && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        {t.songs.lyrics}
                      </h4>
                      <div
                        className="rounded-xl p-3 max-h-28 overflow-y-auto text-sm text-muted-foreground/80 whitespace-pre-wrap leading-relaxed"
                        style={{ background: `${roleColor}08`, border: `1px solid ${roleColor}20` }}
                      >
                        {selectedDisplay.lyrics}
                      </div>
                    </div>
                  )}

                  {/* song preview */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        {t.songs.aiBackingTrack}
                      </h4>
                      <button
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
                        style={{
                          color: roleColor,
                          background: `${roleColor}18`,
                          border: `1px solid ${roleColor}38`,
                        }}
                        onClick={() => setIsPlaying(!isPlaying)}
                      >
                        {isPlaying ? t.songs.pausePreview : t.songs.playPreview}
                      </button>
                    </div>

                    <div
                      className="rounded-xl p-4 min-h-[108px] flex flex-col justify-center items-center"
                      style={{ background: `${roleColor}08`, border: `1px solid ${roleColor}18` }}
                    >
                      {isPlaying ? (
                        <div className="w-full space-y-3">
                          <div className="flex items-end justify-center gap-1" style={{ height: 32 }}>
                            {BAR_HEIGHTS.map((h, i) => (
                              <div
                                key={i}
                                className="w-1.5 rounded-full animate-bounce"
                                style={{
                                  height: h,
                                  background: roleColor,
                                  opacity: 0.65 + (i % 3) * 0.12,
                                  animationDelay: `${i * 0.08}s`,
                                  animationDuration: `${0.55 + (i % 4) * 0.14}s`,
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-sm font-bold text-center" style={{ color: roleColor }}>
                            {currentLyric || "♪  ♩  ♫"}
                          </p>
                          <div className="w-full h-1 rounded-full" style={{ background: `${roleColor}20` }}>
                            <div
                              className="h-full rounded-full transition-all duration-300 ease-linear"
                              style={{
                                width: `${(currentTime / (audio?.duration || 180)) * 100}%`,
                                background: roleColor,
                                boxShadow: `0 0 6px ${roleColor}55`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <p className="text-xs text-muted-foreground/45">{t.songs.backingTrackSim}</p>
                          <p className="text-sm font-semibold">{selectedDisplay?.title || selectedSong.title}</p>
                          <p className="text-xs text-muted-foreground/45">{selectedSong.artist}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* practice button */}
                  <button
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${roleColor}dd, ${roleColor}aa)`,
                      boxShadow: `0 4px 16px ${roleColor}38`,
                    }}
                    onClick={() => {
                      localStorage.setItem("selectedSong", JSON.stringify(selectedSong));
                      localStorage.setItem("backingTrack", JSON.stringify(backingTrack));
                      router.push(`/perform?songId=${selectedSong.id}&from=songs`);
                    }}
                    data-testid="button-practice-song"
                  >
                    {t.songs.practiceSong}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ─ Empty state ─ */
            <div className="rounded-2xl overflow-hidden border border-border/25 bg-muted/8 min-h-[320px] flex flex-col items-center justify-center relative">
              {/* floating note decorations */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {FLOAT_NOTES.map((n, i) => (
                  <span
                    key={i}
                    className="absolute text-muted-foreground/10 select-none"
                    style={{
                      left: n.x, top: n.y,
                      fontSize: n.size,
                      animation: `song-float ${n.dur}s ease-in-out infinite`,
                      animationDelay: `${n.delay}s`,
                    }}
                  >
                    {n.note}
                  </span>
                ))}
              </div>
              {/* center content */}
              <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
                <div className="w-16 h-16 rounded-full bg-muted/50 border border-border/30 flex items-center justify-center">
                  <Music className="h-8 w-8 text-muted-foreground/35" />
                </div>
                <p className="text-sm text-muted-foreground/55 max-w-[200px] leading-relaxed">
                  {t.songs.selectSongPlaceholder}
                </p>
              </div>
              <style>{`
                @keyframes song-float {
                  0%, 100% { transform: translateY(0) rotate(-4deg); }
                  50%       { transform: translateY(-14px) rotate(4deg); }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SongsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-9 h-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
