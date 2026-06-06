"use client";

import { MessageSquare, Plus, Store } from "lucide-react";
import { AppLink as Link } from "@/components/AppLink";
import { PageLayout } from "@/components/layout/PageLayout";
import { getSupportMailtoUrl } from "@/lib/legal-config";

export function DashboardEmptyContent() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 sm:p-8">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-50">
        <Store className="size-8 text-brand-600" />
      </div>
      <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">Nenhum negócio cadastrado</h2>
      <p className="mb-6 max-w-sm text-center text-sm text-gray-500 sm:text-base">
        Cadastre seu negócio para começar a usar o atendimento automático no WhatsApp.
      </p>
      <Link
        href="/businesses/new"
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        <Plus className="size-4" />
        Cadastrar meu negócio
      </Link>
      <a
        href={getSupportMailtoUrl("Suporte FlowDesk")}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
      >
        <MessageSquare className="size-4" />
        Falar com suporte
      </a>
    </div>
  );
}

export function DashboardEmptyState() {
  return (
    <PageLayout
      title="Dashboard"
      description="Visão geral de conversas, agendamentos e receita do seu negócio."
    >
      <DashboardEmptyContent />
    </PageLayout>
  );
}
