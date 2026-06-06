import { responses } from '../../openapi/shared.js'

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
}
