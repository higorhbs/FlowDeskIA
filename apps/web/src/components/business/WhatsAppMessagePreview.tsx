import { cn } from "@/lib/utils";

export type PreviewMessage = {
  from: "customer" | "bot";
  text: string;
};

export function WhatsAppMessagePreview({
  businessName,
  messages,
  className,
}: {
  businessName: string;
  messages: PreviewMessage[];
  className?: string;
}) {
  const initial = (businessName.trim()[0] ?? "F").toUpperCase();

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 bg-[#075E54] px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-xs font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            {businessName.trim() || "Seu negócio"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-none text-[#A8D5CF]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4FC3F7]" />
            online
          </p>
        </div>
      </div>

      <div className="min-h-[170px] space-y-2 px-3 py-3" style={{ backgroundColor: "#ECE5DD" }}>
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.from === "bot" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-sm",
                m.from === "bot"
                  ? "rounded-tr-sm bg-[#DCF8C6] text-gray-800"
                  : "rounded-tl-sm bg-white text-gray-800",
              )}
            >
              {m.text.trim() || (
                <span className="italic text-gray-400">Digite a mensagem para ver o preview…</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
