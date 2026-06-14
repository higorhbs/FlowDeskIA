"use client";

import { renderTemplate } from "@flowdesk/shared";
import { cn } from "@/lib/utils";

type Button = { id: string; label: string };

type Props = {
  businessName: string;
  text?: string;
  imageUrl?: string;
  mediaType?: "image" | "video" | "gif";
  buttons?: Button[];
  className?: string;
};

function WaInline({ text }: { text: string }) {
  const tokens = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("*") && t.endsWith("*"))
          return (
            <strong key={i} className="font-semibold">
              {t.slice(1, -1)}
            </strong>
          );
        if (t.startsWith("_") && t.endsWith("_"))
          return (
            <em key={i} className="italic text-gray-500">
              {t.slice(1, -1)}
            </em>
          );
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

function WaBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-[11.5px] leading-[1.45] text-[#111b21]">
      {lines.map((line, i) => (
        <p key={i} className={line.trim() ? "" : "h-1.5"}>
          {line.trim() ? <WaInline text={line} /> : null}
        </p>
      ))}
    </div>
  );
}

function ReplyIcon() {
  return (
    <span className="text-[14px] leading-none text-[#008069]" aria-hidden>
      ↩
    </span>
  );
}

function InteractiveMessage({
  text,
  imageUrl,
  mediaType = "image",
  buttons = [],
}: {
  text?: string;
  imageUrl?: string;
  mediaType?: "image" | "video" | "gif";
  buttons?: Button[];
}) {
  const hasBody = Boolean(text?.trim());
  const hasButtons = buttons.length > 0;

  if (!hasBody && !imageUrl && !hasButtons) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[11px] text-gray-400 shadow-sm">
          Configure a mensagem do primeiro passo
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {imageUrl &&
          (mediaType === "video" ? (
            <video src={imageUrl} className="block w-full max-h-[120px] object-cover" muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="block w-full max-h-[120px] object-cover" />
          ))}
        {hasBody && (
          <div className="px-2.5 pt-2 pb-1">
            <WaBody text={text!.trim()} />
            <div className="mt-1 flex justify-end">
              <span className="text-[9px] leading-none text-[#667781]">15:02</span>
            </div>
          </div>
        )}
        {!hasBody && imageUrl && (
          <div className="px-2.5 pb-1.5 flex justify-end">
            <span className="text-[9px] leading-none text-[#667781]">15:02</span>
          </div>
        )}
        {hasButtons &&
          buttons.map((btn, i) => (
            <div
              key={btn.id}
              className={cn(
                "flex items-center justify-center gap-2 border-t border-[#e9edef] px-3 py-2.5 text-[12px] font-medium text-[#008069]",
                i === 0 && !hasBody && !imageUrl && "border-t-0"
              )}
            >
              <ReplyIcon />
              <span className="truncate">{btn.label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function LeadFlowWaPreview({
  businessName,
  text,
  imageUrl,
  mediaType,
  buttons = [],
  className,
}: Props) {
  const body = text?.trim()
    ? renderTemplate(text, { nome: "Maria", negocio: businessName })
    : "";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-[248px] select-none">
        <div className="relative rounded-[2.6rem] border border-[#48484A] bg-gradient-to-b from-[#3A3A3C] to-[#1C1C1E] shadow-[0_20px_44px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.1)]">
          <div className="absolute -left-[3px] top-[64px] h-6 w-[3px] rounded-l-full bg-[#3A3A3C]" />
          <div className="absolute -left-[3px] top-[96px] h-9 w-[3px] rounded-l-full bg-[#3A3A3C]" />
          <div className="absolute -left-[3px] top-[136px] h-9 w-[3px] rounded-l-full bg-[#3A3A3C]" />
          <div className="absolute -right-[3px] top-[102px] h-12 w-[3px] rounded-r-full bg-[#3A3A3C]" />

          <div className="m-[5px] overflow-hidden rounded-[2.35rem] bg-black">
            <div className="relative flex h-[32px] items-center justify-between bg-[#075E54] px-3">
              <span className="z-10 text-[8px] font-semibold tracking-tight text-white">9:41</span>
              <div className="absolute left-1/2 top-1/2 z-20 flex h-[20px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 rounded-full bg-black">
                <div className="h-[6px] w-[6px] rounded-full border border-[#333] bg-[#1a1a1a]" />
                <div className="h-1.5 w-1.5 rounded-full border border-[#3a3a3a] bg-[#222]" />
              </div>
              <div className="z-10 flex items-center gap-1">
                <svg width="12" height="9" viewBox="0 0 14 10" fill="none" aria-hidden>
                  <rect x="0" y="6" width="2.5" height="4" rx="0.4" fill="white" />
                  <rect x="3.5" y="4" width="2.5" height="6" rx="0.4" fill="white" />
                  <rect x="7" y="2" width="2.5" height="8" rx="0.4" fill="white" />
                  <rect x="10.5" y="0" width="2.5" height="10" rx="0.4" fill="white" opacity="0.35" />
                </svg>
                <svg width="18" height="9" viewBox="0 0 20 10" fill="none" aria-hidden>
                  <rect x="0.5" y="0.5" width="16" height="9" rx="2" stroke="white" strokeOpacity="0.5" />
                  <rect x="2" y="2" width="11" height="6" rx="1" fill="white" />
                  <path d="M17.5 3.5v3a1.5 1.5 0 000-3z" fill="white" fillOpacity="0.5" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#075E54] px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-xs font-bold text-white">
                {businessName.trim()[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold leading-none text-white">{businessName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[8px] text-[#A8D5CF]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#4FC3F7]" />
                  online
                </p>
              </div>
            </div>

            <div
              className="space-y-1.5 px-2 py-2.5 min-h-[220px]"
              style={{
                background:
                  "#E5DDD5 url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              }}
            >
              <div className="mb-1 flex justify-center">
                <span className="rounded-full bg-[#FFF9C4]/90 px-2 py-0.5 text-[8px] font-medium text-[#54656f] shadow-sm">
                  Hoje
                </span>
              </div>

              <div className="flex justify-end">
                <div className="relative max-w-[78%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                  <p className="text-[11px] leading-snug text-[#111b21]">Oi!</p>
                  <div className="mt-0.5 flex items-center justify-end gap-0.5">
                    <span className="text-[9px] text-[#667781]">15:01</span>
                    <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden>
                      <path
                        d="M1 4l2.5 2.5L8 1"
                        stroke="#53BDEB"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 4l2.5 2.5L12 1"
                        stroke="#53BDEB"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <InteractiveMessage text={body} imageUrl={imageUrl} mediaType={mediaType} buttons={buttons} />
            </div>

            <div className="flex items-center gap-1.5 bg-[#F0F2F5] px-2 py-1.5">
              <div className="flex-1 rounded-full bg-white px-3 py-1 shadow-sm">
                <span className="text-[9px] text-gray-400">Mensagem</span>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#128C7E] shadow-sm">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white" aria-hidden>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
            </div>

            <div className="flex justify-center bg-[#F0F0F0] pb-1 pt-0.5">
              <div className="h-1 w-16 rounded-full bg-black/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
