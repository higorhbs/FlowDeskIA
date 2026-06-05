"use client";

import Image from "next/image";
import { Clock, Sparkles } from "lucide-react";
import { APP_DISPLAY_NAME, STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import { Button } from "@/components/ui/button";
import { IaIcon } from "@/lib/ia-brand";
import { useAuthDrawer } from "@/contexts/auth-drawer-context";

export function HeroVisualMobile({ adMode = false }: { adMode?: boolean }) {
  const { openAuth } = useAuthDrawer();

  return (
    <div className="mx-auto mt-8 max-w-lg px-4 sm:px-6 md:hidden">
      <div className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5">
        <div className="relative aspect-[5/4] w-full">
          <Image
            src="/landing/hero-main.jpg"
            alt="Atendimento profissional no negócio local"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-sm font-medium leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              Atendimento automático no WhatsApp, 24h por dia
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-brand-100 bg-white px-2 py-3 text-center shadow-sm">
          <p className="text-lg font-bold text-brand-600">24h</p>
          <p className="text-[10px] font-medium text-gray-500">Online</p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-white px-2 py-3 text-center shadow-sm">
          <p className="text-lg font-bold text-brand-600">847</p>
          <p className="text-[10px] font-medium text-gray-500">Msgs/semana</p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-white px-2 py-3 text-center shadow-sm">
          <p className="flex items-center justify-center gap-0.5 text-lg font-bold text-brand-600">
            <Clock className="size-3.5" />
            30s
          </p>
          <p className="text-[10px] font-medium text-gray-500">Resposta</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-[#e5ddd5] shadow-sm">
        <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5">
          <div className="relative size-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/30">
            <Image
              src="/landing/client-avatar.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{APP_DISPLAY_NAME}</p>
            <p className="text-xs text-white/75">online</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white">
            <IaIcon className="size-3" />
            IA
          </span>
        </div>
        <div className="space-y-2 p-3">
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-gray-800">
            Quanto custa o serviço?
          </div>
          <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
            A partir de R$ 45. Digite <strong>agendar</strong> para marcar!
          </div>
          <div className="ml-auto max-w-[45%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-gray-800">
            agendar
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => openAuth("register")}
        className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-base font-semibold shadow-md shadow-brand-600/25"
      >
        <Sparkles className="mr-2 size-4" />
        {adMode ? `Começar teste grátis — ${STARTER_TRIAL_DAYS} dias` : "Começar teste grátis"}
      </Button>
      {adMode && (
        <p className="mt-2 text-center text-xs text-gray-500">Sem cartão · Setup em minutos</p>
      )}
    </div>
  );
}
