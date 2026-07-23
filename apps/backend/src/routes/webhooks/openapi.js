import { responses } from '../../openapi/shared.js'

const receivedSchema = {
  type: 'object',
  properties: { received: { type: 'boolean', example: true } },
}

export const webhooksPaths = {
  '/webhooks/mercadopago': {
    post: {
      tags: ['Webhooks'],
      summary: 'Webhook Mercado Pago (pagamentos PIX)',
      description: 'Recebe notificações de pagamento; consulta API com token do negócio.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
      },
      responses: {
        200: { description: 'Evento processado', content: { 'application/json': { schema: receivedSchema } } },
      },
    },
    get: {
      tags: ['Webhooks'],
      summary: 'Webhook Mercado Pago (query)',
      responses: {
        200: { description: 'Evento processado', content: { 'application/json': { schema: receivedSchema } } },
      },
    },
  },
  '/webhooks/stripe': {
    post: {
      tags: ['Webhooks'],
      summary: 'Webhook Stripe (assinaturas)',
      description: 'Body raw + header stripe-signature obrigatório.',
      parameters: [
        {
          name: 'stripe-signature',
          in: 'header',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
      responses: {
        200: { description: 'Evento processado', content: { 'application/json': { schema: receivedSchema } } },
        400: responses.badRequest,
      },
    },
  },
}
