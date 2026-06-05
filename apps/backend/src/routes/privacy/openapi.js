import { responses } from '../../openapi/shared.js'

const privacyRequestBody = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['CORRECTION', 'OPPOSITION', 'REVOCATION', 'ERASURE'] },
    details: { type: 'string', maxLength: 2000 },
  },
}

const consentBody = {
  type: 'object',
  required: ['policyVersion'],
  properties: {
    policyVersion: { type: 'string', minLength: 3 },
  },
}

export const privacyPaths = {
  '/privacy/export': {
    get: {
      tags: ['Privacy'],
      summary: 'Exportar dados do titular (LGPD)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Dump completo', content: { 'application/json': { schema: { type: 'object' } } } },
        401: responses.unauthorized,
        404: responses.notFound,
      },
    },
  },
  '/privacy/consent': {
    post: {
      tags: ['Privacy'],
      summary: 'Registrar consentimento LGPD',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: consentBody } } },
      responses: {
        200: { description: 'Consentimento registrado', content: { 'application/json': { schema: { type: 'object' } } } },
        401: responses.unauthorized,
      },
    },
  },
  '/privacy/requests': {
    post: {
      tags: ['Privacy'],
      summary: 'Abrir solicitação LGPD',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: privacyRequestBody } } },
      responses: {
        200: { description: 'Solicitação criada', content: { 'application/json': { schema: { type: 'object' } } } },
        401: responses.unauthorized,
      },
    },
  },
  '/privacy/delete-account': {
    post: {
      tags: ['Privacy'],
      summary: 'Excluir conta e dados permanentemente',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Conta excluída', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
        401: responses.unauthorized,
        500: responses.badRequest,
      },
    },
  },
  '/privacy/anonymize': {
    post: {
      tags: ['Privacy'],
      summary: 'Anonimizar dados pessoais',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Dados anonimizados', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
        401: responses.unauthorized,
      },
    },
  },
  '/privacy/retention/run': {
    post: {
      tags: ['Privacy'],
      summary: 'Executar retenção LGPD (365 dias)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Resumo da retenção', content: { 'application/json': { schema: { type: 'object' } } } },
        401: responses.unauthorized,
      },
    },
  },
}
