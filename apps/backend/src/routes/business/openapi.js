import { errorSchema, responses } from '../../openapi/shared.js'

const businessSchema = {
  type: 'object',
  required: ['id', 'tenantId', 'name', 'type', 'phone', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    tenantId: { type: 'string' },
    name: { type: 'string' },
    type: {
      type: 'string',
      enum: ['BARBERSHOP', 'SALON', 'RESTAURANT', 'DENTAL', 'STORE', 'OTHER'],
    },
    phone: { type: 'string', description: 'WhatsApp (somente dígitos)' },
    description: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
}

const createBody = {
  type: 'object',
  required: ['name', 'type', 'whatsapp'],
  properties: {
    name: { type: 'string', minLength: 2 },
    type: {
      type: 'string',
      enum: ['BARBERSHOP', 'SALON', 'RESTAURANT', 'DENTAL', 'STORE', 'OTHER'],
    },
    whatsapp: { type: 'string', description: 'Número WhatsApp (10–15 dígitos, com DDI)' },
    phone: { type: 'string', description: 'Alias de whatsapp' },
    description: { type: 'string' },
  },
}

export const businessPath = {
  '/business': {
    post: {
      tags: ['Business'],
      summary: 'Criar negócio',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: createBody } },
      },
      responses: {
        201: {
          description: 'Negócio criado',
          content: { 'application/json': { schema: businessSchema } },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        503: {
          description: 'Firebase Admin ausente',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/businesses': {
    get: {
      tags: ['Business'],
      summary: 'Listar negócios do usuário autenticado',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Lista de negócios',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  businesses: { type: 'array', items: businessSchema },
                },
                required: ['businesses'],
              },
            },
          },
        },
        401: responses.unauthorized,
      },
    },
  },
}
