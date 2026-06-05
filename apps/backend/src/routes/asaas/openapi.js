import { businessIdPath, responses } from '../../openapi/shared.js'

const asaasPutBody = {
  type: 'object',
  properties: {
    apiKey: { type: 'string', minLength: 20 },
    sandbox: { type: 'boolean' },
    webhookToken: { type: 'string', minLength: 8, maxLength: 200 },
  },
}

const asaasStatusSchema = {
  type: 'object',
  properties: {
    configured: { type: 'boolean' },
    sandbox: { type: 'boolean' },
    keyPreview: { type: 'string', nullable: true },
    webhookTokenConfigured: { type: 'boolean' },
    webhookTokenPreview: { type: 'string', nullable: true },
    webhookUrl: { type: 'string' },
    balanceBrl: { type: 'number', nullable: true },
  },
}

export const asaasPaths = {
  '/businesses/{id}/integrations/asaas': {
    get: {
      tags: ['Asaas'],
      summary: 'Status da integração Asaas do negócio',
      security: [{ bearerAuth: [] }],
      parameters: [{ ...businessIdPath, name: 'id' }],
      responses: {
        200: { description: 'Status', content: { 'application/json': { schema: asaasStatusSchema } } },
        401: responses.unauthorized,
        403: responses.badRequest,
        404: responses.notFound,
      },
    },
    put: {
      tags: ['Asaas'],
      summary: 'Salvar credenciais Asaas',
      security: [{ bearerAuth: [] }],
      parameters: [{ ...businessIdPath, name: 'id' }],
      requestBody: { required: true, content: { 'application/json': { schema: asaasPutBody } } },
      responses: {
        200: { description: 'Integração salva', content: { 'application/json': { schema: asaasStatusSchema } } },
        400: responses.badRequest,
        401: responses.unauthorized,
        403: responses.badRequest,
        404: responses.notFound,
      },
    },
    delete: {
      tags: ['Asaas'],
      summary: 'Remover integração Asaas',
      security: [{ bearerAuth: [] }],
      parameters: [{ ...businessIdPath, name: 'id' }],
      responses: {
        204: { description: 'Removido' },
        401: responses.unauthorized,
        403: responses.badRequest,
        404: responses.notFound,
      },
    },
  },
}
