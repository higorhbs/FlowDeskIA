import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare, CheckCircle, ArrowLeft, Crown, Zap } from "lucide-react";
import { PLAN_PRICES, planMarketingFeatures } from "@zapflow/shared";

const PLANS: { id: keyof typeof PLAN_PRICES; highlight?: boolean; extras?: string[] }[] = [
  { id: "STARTER" },
  { id: "PRO", highlight: true, extras: ["Cobrança PIX automática", "Relatórios avançados"] },
  { id: "UNLIMITED", extras: ["Suporte prioritário", "Tudo do Pro"] },
];

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50">
      {/* Header */}
      <header className="h-14 px-8 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">ZapFlow</span>
        </Link>
        <Link
          href="/?auth=login"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 mb-4">
            <Zap className="w-3 h-3" />
            14 dias grátis · Sem cartão de crédito
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Planos simples e transparentes</h1>
          <p className="text-gray-500">Sem taxas escondidas. Cancele quando quiser.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(({ id, highlight, extras = [] }) => {
            const price = PLAN_PRICES[id];
            const featureList = [...planMarketingFeatures(id), ...extras];

            return (
              <div
                key={id}
                className={`relative bg-white rounded-2xl border p-7 flex flex-col shadow-sm transition-shadow hover:shadow-md ${
                  highlight
                    ? "border-brand-400 ring-2 ring-brand-400 ring-offset-2"
                    : "border-gray-200"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow">
                    <Crown className="w-3 h-3" />
                    Mais popular
                  </span>
                )}

                <h3 className="text-lg font-bold text-gray-900">{price.label}</h3>
                <p className="mt-2 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">R${price.brl}</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </p>

                <ul className="space-y-2.5 text-sm text-gray-600 flex-1 mb-8">
                  {featureList.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                    14 dias grátis
                  </li>
                </ul>

                <Link
                  href="/?auth=register"
                  className={cn(
                    buttonVariants({ variant: highlight ? "default" : "secondary" }),
                    "h-10 w-full justify-center"
                  )}
                >
                  Começar grátis
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-10">
          Tem dúvidas?{" "}
          <a href="https://wa.me/5531973616454" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
            Fale com a gente
          </a>
        </p>
      </main>
    </div>
  );
}
