export type PrinterConnectionType = "network" | "usb";

export interface PrinterConfig {
  enabled: boolean;
  connectionType: PrinterConnectionType;
  ip: string;
  port: number;
  copies: number;
  /** Token de pareamento do agente local de impressão USB (gerado uma vez, mostrado uma vez). */
  agentToken?: string;
  /** Nome da impressora do sistema operacional escolhida para receber os cupons. */
  agentPrinterName?: string;
  /** Impressoras do SO vistas pelo agente local na última vez que ele reportou. */
  agentPrinters?: string[];
  /** Timestamp ISO do último poll do agente local — usado para exibir online/offline. */
  agentLastSeenAt?: string;
}

export const DEFAULT_PRINTER_PORT = 9100;

export function defaultPrinterConfig(): PrinterConfig {
  return {
    enabled: false,
    connectionType: "network",
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
  const agentPrinters = Array.isArray(raw.agentPrinters)
    ? raw.agentPrinters.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : undefined;
  const normalized: PrinterConfig = {
    enabled: raw.enabled === true,
    connectionType: raw.connectionType === "usb" ? "usb" : "network",
    ip: typeof raw.ip === "string" ? raw.ip.trim() : base.ip,
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? Math.round(port) : base.port,
    copies: Number.isFinite(copies) && copies >= 1 && copies <= 5 ? Math.round(copies) : base.copies,
  };
  if (typeof raw.agentToken === "string" && raw.agentToken.trim()) normalized.agentToken = raw.agentToken.trim();
  if (typeof raw.agentPrinterName === "string" && raw.agentPrinterName.trim()) {
    normalized.agentPrinterName = raw.agentPrinterName.trim();
  }
  if (agentPrinters && agentPrinters.length) normalized.agentPrinters = agentPrinters;
  if (typeof raw.agentLastSeenAt === "string" && raw.agentLastSeenAt.trim()) {
    normalized.agentLastSeenAt = raw.agentLastSeenAt;
  }
  return normalized;
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
