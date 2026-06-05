export const businessIdPath = {
  name: 'businessId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'ID do negócio (Firestore)',
}

export const statusIdPath = {
  name: 'statusId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'ID do agendamento de story',
}

export const seriesIdPath = {
  name: 'seriesId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'ID da série de agendamentos',
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

export const scheduleRepostBody = {
  type: 'object',
  properties: {
    publishNow: {
      type: 'boolean',
      description: 'Se true, ignora calendário e publica em ~5s',
    },
    scheduledDays: {
      type: 'array',
      items: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      description: 'Datas no formato YYYY-MM-DD (obrigatório se publishNow for false)',
    },
    hour: { type: 'integer', minimum: 0, maximum: 23 },
    minute: { type: 'integer', minimum: 0, maximum: 59 },
  },
}

export const scheduledStatusSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    businessId: { type: 'string' },
    mediaUrl: { type: 'string' },
    mediaType: { type: 'string', enum: ['image', 'video'] },
    caption: { type: 'string' },
    scheduledAt: { type: 'string', format: 'date-time' },
    status: {
      type: 'string',
      enum: ['scheduled', 'publishing', 'published', 'failed', 'cancelled'],
    },
    error: { type: 'string' },
    publishedAt: { type: 'string', format: 'date-time' },
    seriesId: { type: 'string' },
    sourceStatusId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
}
