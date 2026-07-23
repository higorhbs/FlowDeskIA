"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Check,
  X,
  Package,
  Truck,
  Store,
  ChefHat,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, getOrderStatusLabel } from "@flowdesk/shared";
import type { Order, OrderStatus } from "@flowdesk/firebase/client";
import { toast } from "sonner";
import { PrinterSettingsCard } from "./PrinterSettingsCard";

const STATUS_META: Record<
  OrderStatus,
  { dot: string; card: string; badge: string }
> = {
  PENDING: {
    dot: "bg-orange-500",
    card: "border-orange-200 bg-orange-50 hover:border-orange-300",
    badge: "bg-orange-100 text-orange-700",
  },
  CONFIRMED: {
    dot: "bg-blue-500",
    card: "border-blue-200 bg-white hover:border-blue-300",
    badge: "bg-blue-100 text-blue-700",
  },
  PREPARING: {
    dot: "bg-purple-500",
    card: "border-purple-200 bg-white hover:border-purple-300",
    badge: "bg-purple-100 text-purple-700",
  },
  READY: {
    dot: "bg-emerald-500",
    card: "border-emerald-200 bg-white hover:border-emerald-300",
    badge: "bg-emerald-100 text-emerald-700",
  },
  DELIVERED: {
    dot: "bg-gray-400",
    card: "border-gray-200 bg-gray-50 opacity-75 hover:opacity-100",
    badge: "bg-gray-100 text-gray-600",
  },
  CANCELLED: {
    dot: "bg-red-400",
    card: "border-red-100 bg-red-50/60 opacity-70 hover:opacity-100",
    badge: "bg-red-100 text-red-600",
  },
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmar",
  PREPARING: "Iniciar preparo",
  READY: "Marcar como pronto",
  DELIVERED: "Concluir",
};

function orderTotal(order: Order): number {
  return order.total ?? order.items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
}

export default function OrdersPanel({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", businessId],
    queryFn: () => orderApi.list(businessId),
    enabled: !!businessId,
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      orderApi.patch(businessId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", businessId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const active = (orders as Order[])
    .filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const finished = (orders as Order[])
    .filter((o) => o.status === "DELIVERED" || o.status === "CANCELLED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  function renderOrderCard(order: Order) {
    const meta = STATUS_META[order.status];
    const nextStatus = NEXT_STATUS[order.status];
    const total = orderTotal(order);
    const when = new Date(order.createdAt);

    return (
      <div
        key={order.id}
        className={cn("rounded-2xl border p-4 shadow-sm transition-colors", meta.card)}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full flex-shrink-0", meta.dot)} />
              <p className="font-semibold text-gray-900 truncate">
                {order.customerName ?? order.customerPhone}
              </p>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.badge)}>
                {getOrderStatusLabel(order.status, order.fulfillment)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(when, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · 🔖 {order.id.slice(0, 8)}
            </p>

            <div className="mt-3 space-y-1">
              {order.items.map((item, i) => (
                <p key={i} className="text-sm text-gray-700">
                  <span className="font-medium">{item.quantity}x</span> {item.name}
                </p>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                {order.fulfillment === "DELIVERY" ? (
                  <Truck className="w-3.5 h-3.5" />
                ) : (
                  <Store className="w-3.5 h-3.5" />
                )}
                {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
              </span>
              {order.paymentMethod && (
                <span className="flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {order.paymentMethod}
                </span>
              )}
              <span className="font-semibold text-gray-700">{formatCurrency(total)}</span>
            </div>

            {order.deliveryAddress && (
              <p className="text-xs text-gray-500 mt-1.5">📍 {order.deliveryAddress}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {nextStatus && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate(
                    { id: order.id, data: { status: nextStatus } },
                    { onSuccess: () => toast.success(NEXT_STATUS_LABEL[nextStatus] ?? "Atualizado") },
                  )
                }
              >
                <Check className="w-3.5 h-3.5" />
                {NEXT_STATUS_LABEL[nextStatus]}
              </Button>
            )}
            {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate(
                    { id: order.id, data: { status: "CANCELLED" } },
                    { onSuccess: () => toast.success("Pedido cancelado") },
                  )
                }
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-brand-600" />
          Pedidos
        </h1>
        <p className="text-gray-500 mt-1">Acompanhe e atualize os pedidos feitos pelo WhatsApp</p>
      </div>

      <PrinterSettingsCard businessId={businessId} />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Nenhum pedido em andamento
        </div>
      ) : (
        <div className="space-y-3 mb-8">{active.map(renderOrderCard)}</div>
      )}

      {finished.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Histórico recente</h2>
          <div className="space-y-3">{finished.map(renderOrderCard)}</div>
        </div>
      )}
    </div>
  );
}
