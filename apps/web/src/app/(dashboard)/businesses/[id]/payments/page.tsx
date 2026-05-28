"use client";

import { Banknote, QrCode, MessageSquare, Zap, Clock, Bell } from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    title: "PIX via WhatsApp",
    desc: "O bot gera o QR Code e o código copia-e-cola direto na conversa com o cliente.",
  },
  {
    icon: Bell,
    title: "Confirmação automática",
    desc: "Assim que o pagamento for identificado, o bot avisa o cliente e registra no painel.",
  },
  {
    icon: MessageSquare,
    title: "Cobrança por mensagem",
    desc: "Envie cobranças avulsas para clientes específicos sem sair do painel.",
  },
  {
    icon: Zap,
    title: "Integração com Asaas",
    desc: "Gestão de recebíveis, histórico de transações e relatórios de faturamento.",
  },
];

export default function PaymentsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center text-center py-16">

      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
        <Banknote className="w-10 h-10 text-brand-600" />
      </div>

      {/* Badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold mb-4">
        <Clock className="w-3.5 h-3.5" />
        Em desenvolvimento
      </span>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Pagamentos por PIX no WhatsApp
      </h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">
        Em breve seus clientes poderão pagar via PIX direto pelo WhatsApp — sem sair da conversa.
        Estamos finalizando a integração e você será notificado quando estiver disponível.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-4 flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4.5 h-4.5 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
