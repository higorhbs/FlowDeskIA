export interface PrinterConfig {
  enabled: boolean;
  ip: string;
  port: number;
  copies: number;
}

export const DEFAULT_PRINTER_PORT = 9100;

export function defaultPrinterConfig(): PrinterConfig {
  return {
    enabled: false,
    ip: "",
    port: DEFAULT_PRINTER_PORT,
    copies: 1,
  };
}

export function normalizePrinterConfig(raw?: Partial<PrinterConfig> | null): PrinterConfig {
  const base = defaultPrinterConfig();
  if (!raw || typeof raw !== "object") return base;
  const port = Number(raw.port);
  const copies = Number(raw.copies);
  return {
    enabled: raw.enabled === true,
    ip: typeof raw.ip === "string" ? raw.ip.trim() : base.ip,
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? Math.round(port) : base.port,
    copies: Number.isFinite(copies) && copies >= 1 && copies <= 5 ? Math.round(copies) : base.copies,
  };
}

interface ReceiptOrderLike {
  id: string;
  customerName?: string;
  customerPhone: string;
  items: { name: string; quantity: number; price?: number }[];
  total?: number;
  fulfillment: string;
  deliveryAddress?: string;
  paymentMethod?: string;
  createdAt: string;
  notes?: string;
}

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const LINE = "------------------------------";

/** Linhas de texto puro do cupom de pedido — usadas tanto na prévia do painel quanto na impressão ESC/POS. */
export function buildOrderReceiptLines(
  order: ReceiptOrderLike,
  businessName: string,
): string[] {
  const total = order.total ?? order.items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
  const when = new Date(order.createdAt);
  const lines: string[] = [];

  lines.push(businessName.toUpperCase());
  lines.push("PEDIDO");
  lines.push(LINE);
  lines.push(`Código: ${order.id.slice(0, 8)}`);
  lines.push(`Data: ${when.toLocaleDateString("pt-BR")} ${when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  lines.push(`Cliente: ${order.customerName || order.customerPhone}`);
  lines.push(LINE);
  for (const item of order.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.price != null && item.price > 0) {
      lines.push(`   ${formatMoney(item.price * item.quantity)}`);
    }
  }
  lines.push(LINE);
  lines.push(`TOTAL: ${formatMoney(total)}`);
  lines.push(order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada no local");
  if (order.deliveryAddress) lines.push(`Endereço: ${order.deliveryAddress}`);
  if (order.paymentMethod) lines.push(`Pagamento: ${order.paymentMethod}`);
  if (order.notes?.trim()) {
    lines.push(LINE);
    lines.push(`Obs: ${order.notes.trim()}`);
  }
  lines.push(LINE);
  lines.push(`Tel: ${order.customerPhone}`);

  return lines;
}
