"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ImageIcon,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import type { ScheduledStatus } from "@/lib/api";
import { RepostStatusModal } from "@/components/status/RepostStatusModal";
import { cn } from "@/lib/utils";

const AUTO_MS = 3800;
const REPOSTABLE: ScheduledStatus["status"][] = ["published", "failed", "cancelled"];

const STATUS_LABEL: Record<ScheduledStatus["status"], string> = {
  scheduled: "Agendado",
  publishing: "Publicando…",
  published: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<ScheduledStatus["status"], string> = {
  scheduled: "bg-blue-500/90 text-white",
  publishing: "bg-amber-500/90 text-white",
  published: "bg-emerald-500/90 text-white",
  failed: "bg-red-500/90 text-white",
  cancelled: "bg-gray-600/90 text-white",
};

type Props = {
  items: ScheduledStatus[];
  businessId: string;
  businessName?: string;
  variant?: "history" | "queue";
  deleting?: boolean;
  seriesPendingCount?: Map<string, number>;
  onRevoke?: (row: ScheduledStatus) => void;
  onCancel?: (row: ScheduledStatus) => void;
  onCancelSeries?: (seriesId: string) => void;
  onReposted?: () => void;
};

export function StatusHistoryCarousel({
  items,
  businessId,
  businessName = "",
  variant = "history",
  deleting,
  seriesPendingCount,
  onRevoke,
  onCancel,
  onCancelSeries,
  onReposted,
}: Props) {
  const isQueue = variant === "queue";

  if (items.length === 0) return null;

  /* ── Queue mode ── */
  if (isQueue) {
    return (
      <QueueList
        items={items}
        deleting={deleting}
        seriesPendingCount={seriesPendingCount}
        onCancel={onCancel}
        onCancelSeries={onCancelSeries}
        onReposted={onReposted}
        businessId={businessId}
      />
    );
  }

  /* ── History mode — carousel ── */
  return (
    <HistoryCarousel
      items={items}
      businessId={businessId}
      businessName={businessName}
      deleting={deleting}
      onRevoke={onRevoke}
      onReposted={onReposted}
    />
  );
}

/* ─────────────────────────────────────────────
   Queue List — one card per story, clear layout
───────────────────────────────────────────────*/
function QueueList({
  items,
  deleting,
  seriesPendingCount,
  onCancel,
  onCancelSeries,
  onReposted,
  businessId,
}: {
  items: ScheduledStatus[];
  deleting?: boolean;
  seriesPendingCount?: Map<string, number>;
  onCancel?: (row: ScheduledStatus) => void;
  onCancelSeries?: (seriesId: string) => void;
  onReposted?: () => void;
  businessId: string;
}) {
  return (
    <div className={cn("p-3 space-y-3", items.length === 1 && "flex flex-col items-center")}>
      {items.map((row) => (
        <QueueCard
          key={row.id}
          row={row}
          single={items.length === 1}
          deleting={deleting}
          seriesPendingCount={seriesPendingCount}
          onCancel={onCancel}
          onCancelSeries={onCancelSeries}
          onReposted={onReposted}
          businessId={businessId}
        />
      ))}
    </div>
  );
}

function QueueCard({
  row,
  single,
  deleting,
  seriesPendingCount,
  onCancel,
  onCancelSeries,
  onReposted,
  businessId,
}: {
  row: ScheduledStatus;
  single: boolean;
  deleting?: boolean;
  seriesPendingCount?: Map<string, number>;
  onCancel?: (row: ScheduledStatus) => void;
  onCancelSeries?: (seriesId: string) => void;
  onReposted?: () => void;
  businessId: string;
}) {
  const isVideo = row.mediaType === "video";
  const scheduledDate = new Date(row.scheduledAt);
  const seriesCount = row.seriesId && seriesPendingCount ? seriesPendingCount.get(row.seriesId) : undefined;
  const showCancelSeries = row.seriesId && onCancelSeries && seriesCount != null && seriesCount > 1;

  return (
    <div className={cn("rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden", single && "w-full max-w-xs")}>
      {/* Media preview */}
      <div className={cn("relative bg-gray-900 overflow-hidden", single ? "h-52" : "h-28 flex-shrink-0")}>
        {row.mediaUrl && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.mediaUrl} alt="" className="w-full h-full object-cover" />
        ) : row.mediaUrl && isVideo ? (
          <video src={row.mediaUrl} className="w-full h-full object-cover" muted playsInline loop autoPlay />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            {isVideo ? (
              <Video className="w-10 h-10 text-gray-600" />
            ) : (
              <ImageIcon className="w-10 h-10 text-gray-600" />
            )}
          </div>
        )}

        {/* Status badge */}
        <span className={cn(
          "absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm",
          STATUS_STYLE[row.status],
        )}>
          <StatusIcon status={row.status} />
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      {/* Info section */}
      <div className="px-4 py-3 space-y-3">
        {/* Scheduled time */}
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-brand-500 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
              Publicará em
            </p>
            <p className="text-sm font-bold text-gray-800 capitalize">
              {format(scheduledDate, "dd 'de' MMMM · HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">
              Legenda
            </p>
          </div>
          {row.caption ? (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{row.caption}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Sem legenda</p>
          )}
        </div>

        {/* Series info */}
        {showCancelSeries && (
          <p className="text-xs text-brand-700 font-medium">
            Série · {seriesCount} stories na fila
          </p>
        )}
        {row.sourceStatusId && (
          <p className="text-xs text-gray-500">Republicação agendada</p>
        )}

        {/* Error */}
        {row.error && (
          <p className="text-xs text-red-600">{row.error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
          {onCancel && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onCancel(row)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 rounded-xl px-3 py-2 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancelar agendamento
            </button>
          )}
          {showCancelSeries && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onCancelSeries!(row.seriesId!)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-700 border border-red-300 bg-red-50 rounded-xl px-3 py-2 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancelar série
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   History Carousel — unchanged slide behaviour
──────────────────────────────────────────────*/
function HistoryCarousel({
  items,
  businessId,
  businessName,
  deleting,
  onRevoke,
  onReposted,
}: {
  items: ScheduledStatus[];
  businessId: string;
  businessName: string;
  deleting?: boolean;
  onRevoke?: (row: ScheduledStatus) => void;
  onReposted?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [repostRow, setRepostRow] = useState<ScheduledStatus | null>(null);
  const [previewRow, setPreviewRow] = useState<ScheduledStatus | null>(null);

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  useEffect(() => { scrollTo(index); }, [index, scrollTo]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const id = window.setInterval(() => setIndex((p) => (p + 1) % items.length), AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const onScroll = () => {
      const center = node.scrollLeft + node.clientWidth / 2;
      let closest = 0, min = Infinity;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i] as HTMLElement;
        const dist = Math.abs(center - (child.offsetLeft + child.offsetWidth / 2));
        if (dist < min) { min = dist; closest = i; }
      }
      setIndex(closest);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const active = items[index] ?? items[0]!;
  const canRepost = REPOSTABLE.includes(active.status);

  function prev() { setIndex((i) => (i - 1 + items.length) % items.length); }
  function next() { setIndex((i) => (i + 1) % items.length); }

  return (
    <div
      className="relative py-3 px-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />

      {items.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label="Anterior"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={next} aria-label="Próximo"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        className={cn(
          "flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          items.length === 1 ? "justify-center px-2" : "px-6",
        )}
      >
        {items.map((row, i) => (
          <StorySlide key={row.id} row={row} active={i === index}
            autoPlaying={!paused && items.length > 1} onSelect={() => setIndex(i)} />
        ))}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2 px-6">
          {items.map((row, i) => (
            <button key={row.id} type="button" aria-label={`Story ${i + 1}`} onClick={() => setIndex(i)}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-brand-600" : "w-1.5 bg-gray-300 hover:bg-gray-400")} />
          ))}
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
            {paused ? <Pause className="w-3 h-3" /> : null}
            {index + 1}/{items.length}
          </span>
        </div>
      )}

      <div className="mt-3 mx-2 rounded-xl bg-gray-50/80 border border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_STYLE[active.status])}>
            <StatusIcon status={active.status} />
            {STATUS_LABEL[active.status]}
          </span>
          <span className="text-[11px] text-gray-500 tabular-nums">
            {format(new Date(active.scheduledAt), "HH:mm", { locale: ptBR })}
          </span>
        </div>
        {active.caption && <p className="text-xs text-gray-800 line-clamp-2 mb-1">{active.caption}</p>}
        {active.error && <p className="text-[11px] text-red-600 line-clamp-2 mb-2">{active.error}</p>}
        <div className="flex flex-wrap gap-1.5">
          {canRepost && (
            <button type="button" onClick={() => setRepostRow(active)}
              className="text-[10px] font-medium text-brand-700 inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2 py-1 hover:bg-brand-50">
              <RotateCcw className="w-3 h-3" /> Repetir
            </button>
          )}
          {active.status === "published" && active.mediaUrl && (
            <button type="button" onClick={() => setPreviewRow(active)}
              className="text-[10px] font-medium text-gray-700 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 hover:bg-gray-100">
              <Play className="w-3 h-3" /> Prévia
            </button>
          )}
          {onRevoke && active.status === "published" && (
            <button type="button" disabled={deleting} onClick={() => onRevoke(active)}
              className="text-[10px] font-medium text-red-700 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="w-3 h-3" /> Apagar
            </button>
          )}
        </div>
      </div>

      {repostRow && (
        <RepostStatusModal businessId={businessId} row={repostRow}
          onClose={() => setRepostRow(null)} onScheduled={() => onReposted?.()} />
      )}

      {previewRow && previewRow.mediaUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewRow(null)}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] aspect-[9/16] w-[min(280px,80vw)] bg-black"
            onClick={(e) => e.stopPropagation()}>
            {previewRow.mediaType === "video" ? (
              <video src={previewRow.mediaUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewRow.mediaUrl} alt="" className="w-full h-full object-cover" />
            )}
            {previewRow.caption && (
              <p className="absolute bottom-0 inset-x-0 px-3 py-4 text-white text-sm text-center bg-gradient-to-t from-black/80 to-transparent">
                {previewRow.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Story slide (history carousel only) ── */
function StorySlide({ row, active, autoPlaying, onSelect }: {
  row: ScheduledStatus; active: boolean; autoPlaying: boolean; onSelect: () => void;
}) {
  const isVideo = row.mediaType === "video";
  const time = format(new Date(row.scheduledAt), "HH:mm", { locale: ptBR });

  return (
    <button type="button" onClick={onSelect}
      className={cn(
        "snap-center shrink-0 relative rounded-2xl overflow-hidden transition-all duration-300 ring-2 shadow-lg",
        active ? "w-[132px] aspect-[9/16] ring-brand-500 scale-100 opacity-100"
               : "w-[108px] aspect-[9/16] ring-transparent scale-[0.92] opacity-70 hover:opacity-90",
      )}>
      <div className="absolute inset-x-2 top-2 z-20 flex gap-0.5">
        <div className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
          <div key={active && autoPlaying ? "playing" : "idle"}
            className={cn("h-full bg-white rounded-full", active && autoPlaying ? "animate-story-progress w-0" : active ? "w-full" : "w-0")}
            style={{ animationDuration: `${AUTO_MS}ms` }} />
        </div>
      </div>
      <span className={cn("absolute top-5 left-2 z-20 text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm", STATUS_STYLE[row.status])}>
        {STATUS_LABEL[row.status]}
      </span>
      <span className="absolute top-5 right-2 z-20 text-[9px] font-medium text-white/90 tabular-nums drop-shadow">{time}</span>
      <div className="absolute inset-0 bg-gray-900">
        {row.mediaUrl && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.mediaUrl} alt="" className="w-full h-full object-cover" />
        ) : row.mediaUrl && isVideo ? (
          <video src={row.mediaUrl} className="w-full h-full object-cover" muted playsInline loop autoPlay={active} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            {isVideo ? <Video className="w-8 h-8 text-gray-500" /> : <ImageIcon className="w-8 h-8 text-gray-500" />}
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/35 to-transparent pt-8 pb-2 px-2">
        {row.caption
          ? <p className="text-[10px] text-white line-clamp-2 text-left leading-snug">{row.caption}</p>
          : <p className="text-[10px] text-white/50 text-left">Sem legenda</p>}
      </div>
    </button>
  );
}

function StatusIcon({ status }: { status: ScheduledStatus["status"] }) {
  const cls = "w-3 h-3";
  if (status === "published") return <CheckCircle2 className={cls} />;
  if (status === "failed") return <XCircle className={cls} />;
  return <CircleDot className={cls} />;
}
