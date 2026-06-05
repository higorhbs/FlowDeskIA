export const businessIdPath = {
  name: 'businessId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'ID do negócio (Firestore)',
}

export const forceQuery = {
  name: 'force',
  in: 'query',
  required: false,
  schema: { type: 'string', enum: ['1'] },
  description: 'Use force=1 para gerar nova sessão WhatsApp',
}

export const internalSecretHeader = {
  name: 'x-internal-secret',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Mesmo valor de INTERNAL_NOTIFY_SECRET',
}

export const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
  },
}

export const responses = {
  unauthorized: {
    description: 'Token ausente ou inválido',
    content: { 'application/json': { schema: errorSchema } },
  },
  badRequest: {
    description: 'Dados inválidos',
    content: { 'application/json': { schema: errorSchema } },
  },
  notFound: {
    description: 'Recurso não encontrado',
    content: { 'application/json': { schema: errorSchema } },
  },
}

export const multipartFile = {
  type: 'string',
  format: 'binary',
}

