"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
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
  ChevronDown,
  Flame,
  CheckCircle2,
  Wallet,
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

const MAX_DAY_GROUPS = 30;

function orderTotal(order: Order): number {
  return order.total ?? order.items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
}

function isTerminal(order: Order): boolean {
  return order.status === "DELIVERED" || order.status === "CANCELLED";
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "EEEE", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
}

type DayGroup = { key: string; date: Date; orders: Order[] };

function groupByDay(orders: Order[]): DayGroup[] {
  const map = new Map<string, Order[]>();
  for (const order of orders) {
    const key = startOfDay(new Date(order.createdAt)).toISOString();
    const arr = map.get(key);
    if (arr) arr.push(order);
    else map.set(key, [order]);
  }
  return Array.from(map.entries())
    .map(([key, dayOrders]) => ({ key, date: new Date(key), orders: sortWithinDay(dayOrders) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function sortWithinDay(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const ra = isTerminal(a) ? 1 : 0;
    const rb = isTerminal(b) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return ra === 0 ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
  });
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

  const allOrders = orders as Order[];
  const activeCount = allOrders.filter((o) => !isTerminal(o)).length;
  const readyCount = allOrders.filter((o) => o.status === "READY").length;
  const todayDelivered = allOrders.filter((o) => o.status === "DELIVERED" && isToday(new Date(o.createdAt)));
  const todayRevenue = todayDelivered.reduce((sum, o) => sum + orderTotal(o), 0);

  const dayGroups = groupByDay(allOrders).slice(0, MAX_DAY_GROUPS);

  function renderOrderCard(order: Order) {
    const meta = STATUS_META[order.status];
    const nextStatus = NEXT_STATUS[order.status];
    const total = orderTotal(order);
    const when = new Date(order.createdAt);
    const terminal = isTerminal(order);

    return (
      <div
        key={order.id}
        className={cn(
          "flex flex-col rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md",
          meta.card,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", meta.dot)} />
            <p className="font-semibold text-gray-900 truncate">
              {order.customerName ?? order.customerPhone}
            </p>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{format(when, "HH:mm")}</span>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.badge)}>
            {getOrderStatusLabel(order.status, order.fulfillment)}
          </span>
          <span className="text-xs text-gray-400">🔖 {order.id.slice(0, 6)}</span>
        </div>

        <div className="mt-3 space-y-1 flex-1">
          {order.items.slice(0, 5).map((item, i) => (
            <p key={i} className="text-sm text-gray-700 truncate">
              <span className="font-medium">{item.quantity}x</span> {item.name}
            </p>
          ))}
          {order.items.length > 5 && (
            <p className="text-xs text-gray-400">+{order.items.length - 5} item(ns)</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
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
          <span className="ml-auto font-semibold text-gray-800">{formatCurrency(total)}</span>
        </div>

        {order.deliveryAddress && (
          <p className="text-xs text-gray-500 mt-1.5 truncate">📍 {order.deliveryAddress}</p>
        )}

        {!terminal && (
          <div className="mt-3 pt-3 border-t border-black/5 flex gap-2">
            {nextStatus && (
              <Button
                type="button"
                size="sm"
                className="flex-1 gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
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
          </div>
        )}
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

      {!isLoading && allOrders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Em andamento</p>
              <p className="text-lg font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Prontos</p>
              <p className="text-lg font-bold text-gray-900">{readyCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Finalizados hoje</p>
              <p className="text-lg font-bold text-gray-900">{todayDelivered.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Faturamento hoje</p>
              <p className="text-lg font-bold text-gray-900 truncate">{formatCurrency(todayRevenue)}</p>
            </div>
          </div>
        </div>
      )}

      <PrinterSettingsCard businessId={businessId} />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : allOrders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Nenhum pedido registrado ainda
        </div>
      ) : (
        <div className="space-y-3">
          {dayGroups.map((group) => {
            const today = isToday(group.date);
            const dayRevenue = group.orders
              .filter((o) => o.status === "DELIVERED")
              .reduce((sum, o) => sum + orderTotal(o), 0);

            return (
              <details key={group.key} open={today} className="group/day">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-2 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="text-sm font-bold text-gray-900">{dayLabel(group.date)}</h2>
                    <span className="text-xs text-gray-400">
                      {format(group.date, "d 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {group.orders.length} pedido{group.orders.length === 1 ? "" : "s"}
                    </span>
                    {dayRevenue > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                        {formatCurrency(dayRevenue)}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400 transition-transform group-open/day:rotate-180" />
                </summary>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mt-3 mb-2">
                  {group.orders.map(renderOrderCard)}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
