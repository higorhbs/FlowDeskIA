"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { resolveChatMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WAVE_BARS = [4, 7, 11, 15, 18, 13, 8, 16, 10, 7, 17, 11, 14, 6, 9, 14, 7, 12, 16, 9, 14, 7, 11, 15, 8, 13, 6, 10, 14, 5];

export function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playSrc = useMemo(() => resolveChatMediaUrl(src) ?? src, [src]);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setLoadError(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    audioRef.current?.load();
  }, [playSrc]);

  const progress = duration > 0 ? current / duration : 0;

  function fmt(s: number) {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  async function toggle() {
    const a = audioRef.current;
    if (!a || loadError) return;
    if (playing) {
      a.pause();
      return;
    }
    try {
      await a.play();
    } catch {
      setLoadError(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-0.5">
      <audio
        ref={audioRef}
        src={playSrc}
        preload="metadata"
        playsInline
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onCanPlay={() => setLoadError(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setLoadError(true)}
      />
      <Button
        type="button"
        onClick={toggle}
        disabled={loadError}
        variant="ghost"
        size="icon-sm"
        className={cn(
          "rounded-full flex-shrink-0",
          isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-brand-100 hover:bg-brand-200 text-brand-700",
        )}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-px h-5 mb-1 cursor-pointer" onClick={seek}>
          {WAVE_BARS.map((h, i) => {
            const filled = i / WAVE_BARS.length <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  filled
                    ? isOwn
                      ? "bg-white/85"
                      : "bg-brand-500"
                    : isOwn
                      ? "bg-white/30"
                      : "bg-gray-300",
                )}
                style={{ height: h }}
              />
            );
          })}
        </div>
        <p className={cn("text-[10px] leading-none tabular-nums", isOwn ? "text-white/65" : "text-gray-400")}>
          {loadError ? "erro ao carregar" : playing || current > 0 ? fmt(current) : fmt(duration)}
        </p>
        {loadError && (
          <a
            href={playSrc}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("text-[10px] underline", isOwn ? "text-white/80" : "text-brand-600")}
          >
            Abrir áudio
          </a>
        )}
      </div>
      <Mic className={cn("w-3.5 h-3.5 flex-shrink-0", isOwn ? "text-white/50" : "text-gray-300")} />
    </div>
  );
}
