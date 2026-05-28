import Image from "next/image";
import { cn } from "@/lib/utils";

export function WhatsAppInset({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hero-glass-border overflow-hidden rounded-2xl bg-[#e5ddd5]",
        className
      )}
    >
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2">
        <div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/30">
          <Image
            src="/landing/client-avatar.jpg"
            alt="Foto de perfil do cliente"
            fill
            className="object-cover"
            sizes="28px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white">Cliente</p>
          <p className="text-[10px] text-white/70">online</p>
        </div>
      </div>
      <div className="space-y-2 p-2.5">
        <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-2 py-1.5 text-[10px] leading-snug text-gray-800">
          Quanto custa o corte?
        </div>
        <div className="max-w-[90%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 text-[10px] leading-snug text-gray-800">
          Corte R$ 45. Digite <strong>agendar</strong> para marcar!
        </div>
        <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-2 py-1.5 text-[10px] text-gray-800">
          agendar
        </div>
      </div>
    </div>
  );
}
