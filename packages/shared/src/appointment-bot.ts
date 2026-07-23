export interface AppointmentBotConfig {
  startMessage: string;
  clientInputExample: string;
  completedMessage: string;
  awaitingMessage: string;
  requiresApproval: boolean;
}

export const DEFAULT_APPOINTMENT_START_MESSAGE =
  "📅 *Agendamentos — {negocio}*\n\nQual data você prefere? (ex: *15/06* ou *amanhã*)";

export const DEFAULT_APPOINTMENT_CLIENT_INPUT = "15/06";

export const DEFAULT_APPOINTMENT_COMPLETED_MESSAGE =
  "✅ *Agendamento confirmado!*\n\n" +
  "📅 Data: *{data}*\n" +
  "🕐 Horário: *{hora}*\n" +
  "🔖 Código: *{codigo}*\n\n" +
  "Para consultar depois, digite *meu agendamento*.\n\n" +
  "Te esperamos! 😊 Qualquer dúvida é só chamar.";

export const DEFAULT_APPOINTMENT_AWAITING_MESSAGE =
  "📋 *Solicitação registrada!*\n\n" +
  "📅 Data: *{data}*\n" +
  "🕐 Horário: *{hora}*\n" +
  "🔖 Código: *{codigo}*\n\n" +
  "Você receberá uma mensagem quando for confirmado.\n\n" +
  "Para acompanhar: *meu agendamento*.";

export function defaultAppointmentBotConfig(): AppointmentBotConfig {
  return {
    startMessage: DEFAULT_APPOINTMENT_START_MESSAGE,
    clientInputExample: DEFAULT_APPOINTMENT_CLIENT_INPUT,
    completedMessage: DEFAULT_APPOINTMENT_COMPLETED_MESSAGE,
    awaitingMessage: DEFAULT_APPOINTMENT_AWAITING_MESSAGE,
    requiresApproval: false,
  };
}

export function normalizeAppointmentBotConfig(
  raw?: Partial<AppointmentBotConfig> | null,
): AppointmentBotConfig {
  const base = defaultAppointmentBotConfig();
  if (!raw || typeof raw !== "object") return base;
  return {
    startMessage:
      typeof raw.startMessage === "string" && raw.startMessage.trim()
        ? raw.startMessage
        : base.startMessage,
    clientInputExample:
      typeof raw.clientInputExample === "string" && raw.clientInputExample.trim()
        ? raw.clientInputExample.trim()
        : base.clientInputExample,
    completedMessage:
      typeof raw.completedMessage === "string" && raw.completedMessage.trim()
        ? raw.completedMessage
        : base.completedMessage,
    awaitingMessage:
      typeof raw.awaitingMessage === "string" && raw.awaitingMessage.trim()
        ? raw.awaitingMessage
        : base.awaitingMessage,
    requiresApproval: raw.requiresApproval === true,
  };
}
