import { errorSchema, internalSecretHeader, responses } from '../../../openapi/shared.js'

const paymentNotifyBody = {
  type: 'object',
  required: ['businessId', 'customerPhone'],
  properties: {
    businessId: { type: 'string' },
    customerPhone: { type: 'string' },
    amount: { type: 'number' },
    description: { type: 'string' },
  },
  additionalProperties: true,
}

const bookingNotifyBody = {
  type: 'object',
  required: ['business', 'appointment'],
  properties: {
    business: { type: 'object', additionalProperties: true },
    appointment: { type: 'object', additionalProperties: true },
  },
}

export const internalNotificationsPaths = {
  '/internal/notifications/payment': {
    post: {
      tags: ['Internal'],
      summary: 'Notificar pagamento recebido no WhatsApp',
      description: 'Chamado por apps/api após webhook Asaas PAID. Header x-internal-secret obrigatório.',
      parameters: [internalSecretHeader],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: paymentNotifyBody } },
      },
      responses: {
        200: {
          description: 'Encaminhado ao bot',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { ok: { type: 'boolean', example: true } },
              },
            },
          },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        503: {
          description: 'INTERNAL_NOTIFY_SECRET não configurado',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/internal/notifications/booking': {
    post: {
      tags: ['Internal'],
      summary: 'Notificar agendamento confirmado no WhatsApp',
      parameters: [internalSecretHeader],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: bookingNotifyBody } },
      },
      responses: {
        200: {
          description: 'Encaminhado ao bot',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { ok: { type: 'boolean', example: true } },
              },
            },
          },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        503: {
          description: 'INTERNAL_NOTIFY_SECRET não configurado',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
}
