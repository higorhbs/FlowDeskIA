import { responses } from '../../openapi/shared.js'

const receivedSchema = {
  type: 'object',
  properties: { received: { type: 'boolean', example: true } },
}

export const webhooksPaths = {
  '/webhooks/asaas': {
    post: {
      tags: ['Webhooks'],
      summary: 'Webhook Asaas (pagamentos PIX)',
      description: 'Valida header asaas-access-token (global ou por negócio).',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
      },
      responses: {
        200: { description: 'Evento processado', content: { 'application/json': { schema: receivedSchema } } },
        401: responses.unauthorized,
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
