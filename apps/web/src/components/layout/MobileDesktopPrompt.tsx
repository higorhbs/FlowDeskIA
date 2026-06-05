"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone, ArrowRight, Copy, Check } from "lucide-react";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { Button } from "@/components/ui/button";

type MobileDesktopPromptProps = {
  variant?: "default" | "setup";
};

export function MobileDesktopPrompt({ variant = "default" }: MobileDesktopPromptProps) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-600">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex items-center justify-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25 shadow-lg animate-[pulse_2.5s_ease-in-out_infinite]">
            <Smartphone className="h-8 w-8 text-white/90" />
          </div>
          <ArrowRight className="h-6 w-6 text-white/70 shrink-0 animate-[bounce_2s_ease-in-out_infinite]" />
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/20">
            <Monitor className="h-10 w-10 text-brand-600" />
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">
          {APP_DISPLAY_NAME}
        </p>
        <h1 className="text-2xl font-bold text-white leading-tight mb-3">
          {variant === "setup"
            ? "Negócio criado! Use o painel no computador"
            : "O painel funciona no computador"}
        </h1>
        <p className="text-sm text-white/85 leading-relaxed mb-8">
          {variant === "setup" ? (
            <>
              Sua conta e seu negócio já estão salvos na nuvem. Para conectar o WhatsApp,
              conversas, IA e demais ferramentas, abra este mesmo endereço no{" "}
              <strong className="font-semibold text-white">Chrome, Edge ou Safari no PC</strong>.
            </>
          ) : (
            <>
              O painel completo ainda não está disponível no celular. Abra este mesmo endereço no{" "}
              <strong className="font-semibold text-white">Chrome, Edge ou Safari no PC</strong>{" "}
              para usar o sistema com segurança.
            </>
          )}
        </p>

        <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-5 text-left shadow-2xl shadow-black/15 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Como acessar
          </p>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                1
              </span>
              <span>No notebook ou desktop, abra o navegador e digite o link abaixo.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                2
              </span>
              <span>Entre com a mesma conta — tudo estará sincronizado na nuvem.</span>
            </li>
          </ol>

          {url && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-medium text-gray-400 mb-1">Link do painel</p>
              <p className="text-xs text-gray-800 break-all leading-snug">{url}</p>
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            variant="default"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Link copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar link para o PC
              </>
            )}
          </Button>
        </div>

        <p className="mt-6 text-xs text-white/60">
          {variant === "setup"
            ? "No celular você já pode criar conta e cadastrar o negócio; o restante é no desktop."
            : "Obrigado pela paciência — em breve podemos ter suporte mobile."}
        </p>
      </div>
    </div>
  );
}
