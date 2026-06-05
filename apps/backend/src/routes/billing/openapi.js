import { responses } from '../../openapi/shared.js'

const planBody = {
  type: 'object',
  required: ['plan'],
  properties: {
    plan: { type: 'string', enum: ['STARTER', 'PRO', 'UNLIMITED'] },
  },
}

const urlResponse = {
  type: 'object',
  properties: { url: { type: 'string', format: 'uri' } },
}

export const billingPaths = {
  '/billing/sync': {
    post: {
      tags: ['Billing'],
      summary: 'Sincronizar assinatura Stripe com tenant',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Estado de cobrança atualizado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  plan: { type: 'string' },
                  planStatus: { type: 'string' },
                  stripeCustomerId: { type: 'string', nullable: true },
                  stripeSubscriptionId: { type: 'string', nullable: true },
                  subscriptionStatus: { type: 'string', nullable: true },
                  cancelAtPeriodEnd: { type: 'boolean' },
                  currentPeriodEnd: { type: 'string', nullable: true },
                  canceledAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        401: responses.unauthorized,
        503: { description: 'Admin SDK ou Stripe ausente', content: { 'application/json': { schema: { type: 'object' } } } },
      },
    },
  },
  '/billing/checkout': {
    post: {
      tags: ['Billing'],
      summary: 'Iniciar checkout Stripe',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: planBody } } },
      responses: {
        200: { description: 'URL de checkout', content: { 'application/json': { schema: urlResponse } } },
        400: responses.badRequest,
        401: responses.unauthorized,
        502: responses.badRequest,
      },
    },
  },
  '/billing/portal': {
    post: {
      tags: ['Billing'],
      summary: 'Portal de cobrança Stripe',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'URL do portal', content: { 'application/json': { schema: urlResponse } } },
        400: responses.badRequest,
        401: responses.unauthorized,
      },
    },
  },
  '/billing/prices': {
    get: {
      tags: ['Billing'],
      summary: 'Preços dos planos',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Mapa de preços',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        401: responses.unauthorized,
      },
    },
  },
}
