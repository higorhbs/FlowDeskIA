export interface OrderBotConfig {
  enabled: boolean;
  triggerKeywords: string[];
  startMessage: string;
  fulfillmentDelivery: boolean;
  fulfillmentPickup: boolean;
  paymentMethods: string[];
  completedMessage: string;
  awaitingMessage: string;
  requiresApproval: boolean;
  askAddMoreItems: boolean;
  cartFooterMessage: string;
}

export const DEFAULT_ORDER_TRIGGER_KEYWORDS = [
  "pedido",
  "fazer pedido",
  "quero pedir",
  "quero fazer um pedido",
  "delivery",
];

export const DEFAULT_ORDER_START_MESSAGE =
  "🍽️ *Pedido — {negocio}*\n\nVeja o cardápio de hoje e digite o número do prato (ex: *2* ou *2x3* para 3 unidades). Pode pedir mais de um prato — quando terminar, digite *fechar pedido*.";

export const DEFAULT_ORDER_PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão na entrega"];

export const DEFAULT_ORDER_COMPLETED_MESSAGE =
  "✅ *Pedido confirmado!*\n\n" +
  "🧾 Itens:\n{itens}\n" +
  "💰 Total: *{total}*\n" +
  "🚚 Entrega/retirada: *{entrega}*\n" +
  "💳 Pagamento: *{pagamento}*\n" +
  "🔖 Código: *{codigo}*\n\n" +
  "Para acompanhar, digite *meu pedido*.\n\nObrigado pela preferência! 😊";

export const DEFAULT_ORDER_AWAITING_MESSAGE =
  "📋 *Pedido recebido!*\n\n" +
  "🧾 Itens:\n{itens}\n" +
  "💰 Total: *{total}*\n" +
  "🚚 Entrega/retirada: *{entrega}*\n" +
  "💳 Pagamento: *{pagamento}*\n" +
  "🔖 Código: *{codigo}*\n\n" +
  "Você receberá uma mensagem quando o restaurante confirmar.\n\nPara acompanhar, digite *meu pedido*.";

export const DEFAULT_ORDER_CART_FOOTER_MESSAGE =
  "Digite outro número pra adicionar mais, ou *fechar pedido* pra continuar.";

export function defaultOrderBotConfig(): OrderBotConfig {
  return {
    enabled: false,
    triggerKeywords: DEFAULT_ORDER_TRIGGER_KEYWORDS,
    startMessage: DEFAULT_ORDER_START_MESSAGE,
    fulfillmentDelivery: true,
    fulfillmentPickup: true,
    paymentMethods: DEFAULT_ORDER_PAYMENT_METHODS,
    completedMessage: DEFAULT_ORDER_COMPLETED_MESSAGE,
    awaitingMessage: DEFAULT_ORDER_AWAITING_MESSAGE,
    requiresApproval: true,
    askAddMoreItems: true,
    cartFooterMessage: DEFAULT_ORDER_CART_FOOTER_MESSAGE,
  };
}

function normalizedStringList(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const cleaned = raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

export function normalizeOrderBotConfig(
  raw?: Partial<OrderBotConfig> | null,
): OrderBotConfig {
  const base = defaultOrderBotConfig();
  if (!raw || typeof raw !== "object") return base;
  return {
    enabled: raw.enabled === true,
    triggerKeywords: normalizedStringList(raw.triggerKeywords, base.triggerKeywords),
    startMessage:
      typeof raw.startMessage === "string" && raw.startMessage.trim()
        ? raw.startMessage
        : base.startMessage,
    fulfillmentDelivery: raw.fulfillmentDelivery !== false,
    fulfillmentPickup: raw.fulfillmentPickup !== false,
    paymentMethods: normalizedStringList(raw.paymentMethods, base.paymentMethods),
    completedMessage:
      typeof raw.completedMessage === "string" && raw.completedMessage.trim()
        ? raw.completedMessage
        : base.completedMessage,
    awaitingMessage:
      typeof raw.awaitingMessage === "string" && raw.awaitingMessage.trim()
        ? raw.awaitingMessage
        : base.awaitingMessage,
    requiresApproval: raw.requiresApproval !== false,
    askAddMoreItems: raw.askAddMoreItems !== false,
    cartFooterMessage:
      typeof raw.cartFooterMessage === "string" && raw.cartFooterMessage.trim()
        ? raw.cartFooterMessage
        : base.cartFooterMessage,
  };
}

const MY_ORDER_HINTS = [
  "meu pedido",
  "ver pedido",
  "status do pedido",
  "pedido marcado",
  "onde está meu pedido",
];

export const ORDER_CLOSE_COMMANDS = [
  "fechar pedido",
  "fechar",
  "finalizar",
  "finalizar pedido",
  "concluir",
  "concluir pedido",
];

export function isMyOrderStatusTrigger(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return MY_ORDER_HINTS.some((h) => normalized.includes(h));
}

export function isOrderCloseCommand(text: string): boolean {
  return ORDER_CLOSE_COMMANDS.includes(text.toLowerCase().trim());
}

export function isOrderBotTrigger(
  text: string,
  config: OrderBotConfig,
): boolean {
  if (!config.enabled) return false;
  const normalized = text.toLowerCase().trim();
  if (!normalized || isMyOrderStatusTrigger(normalized) || isOrderCloseCommand(normalized)) {
    return false;
  }
  const keywords =
    config.triggerKeywords.length > 0
      ? config.triggerKeywords
      : DEFAULT_ORDER_TRIGGER_KEYWORDS;
  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    return k.length > 0 && normalized.includes(k);
  });
}
