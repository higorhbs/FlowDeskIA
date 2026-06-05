import {
  businessIdPath,
  errorSchema,
  multipartFile,
  responses,
  scheduleRepostBody,
  scheduledStatusSchema,
  seriesIdPath,
  statusIdPath,
} from '../../../openapi/shared.js'

const storyScheduleMultipart = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      ...multipartFile,
      description: 'Imagem (JPEG/PNG/WebP) ou vídeo (MP4)',
    },
    publishNow: {
      type: 'string',
      description: 'true para publicar em ~5s (ignora scheduledDays/hour/minute)',
      example: 'true',
    },
    scheduledDays: {
      type: 'string',
      description: 'JSON array de dias YYYY-MM-DD (obrigatório se publishNow não for true)',
      example: '["2026-06-10"]',
    },
    hour: { type: 'integer', minimum: 0, maximum: 23, example: 14 },
    minute: { type: 'integer', minimum: 0, maximum: 59, example: 30 },
    caption: { type: 'string', maxLength: 700 },
    recurrenceMode: {
      type: 'string',
      enum: ['none', 'interval', 'weekdays'],
    },
    recurrenceIntervalDays: { type: 'integer', enum: [1, 2, 7, 15] },
    recurrenceWeekdays: {
      type: 'string',
      description: 'JSON array 0=Dom … 6=Sab',
      example: '[1,3,5]',
    },
    recurrenceStartDayKey: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    },
  },
}

const storyCreateJson = {
  type: 'object',
  required: ['mediaUrl', 'mediaType'],
  properties: {
    mediaUrl: { type: 'string', format: 'uri' },
    mediaType: { type: 'string', enum: ['image', 'video'] },
    caption: { type: 'string', maxLength: 700 },
    publishNow: { type: 'boolean' },
    scheduledDays: {
      type: 'array',
      items: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
    hour: { type: 'integer', minimum: 0, maximum: 23 },
    minute: { type: 'integer', minimum: 0, maximum: 59 },
    recurrenceMode: {
      type: 'string',
      enum: ['none', 'interval', 'weekdays'],
    },
    recurrenceIntervalDays: { type: 'integer', enum: [1, 2, 7, 15] },
    recurrenceWeekdays: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 6 },
    },
    recurrenceStartDayKey: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    },
  },
}

export const storiesWhatsappPaths = {
  '/stories/whatsapp/{businessId}': {
    get: {
      tags: ['Stories WhatsApp'],
      summary: 'Lista stories agendados do negócio',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      responses: {
        200: {
          description: 'Lista ordenada por scheduledAt desc',
          content: {
            'application/json': {
              schema: { type: 'array', items: scheduledStatusSchema },
            },
          },
        },
        401: responses.unauthorized,
        404: responses.notFound,
      },
    },
    post: {
      tags: ['Stories WhatsApp'],
      summary: 'Upload da mídia + agendamento (uma requisição)',
      description:
        'Preferir multipart/form-data. JSON com mediaUrl já salva também é aceito (legado).',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: storyScheduleMultipart,
          },
          'application/json': {
            schema: storyCreateJson,
          },
        },
      },
      responses: {
        200: {
          description: 'Um ou mais agendamentos criados',
          content: {
            'application/json': {
              schema: { type: 'array', items: scheduledStatusSchema },
            },
          },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        403: {
          description: 'Limite de stories do plano',
          content: { 'application/json': { schema: errorSchema } },
        },
        503: {
          description: 'Workers WhatsApp desligados',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/stories/whatsapp/{businessId}/{statusId}/repost': {
    post: {
      tags: ['Stories WhatsApp'],
      summary: 'Reagenda story (republicação)',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath, statusIdPath],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: scheduleRepostBody } },
      },
      responses: {
        200: {
          description: 'Novos agendamentos criados',
          content: {
            'application/json': {
              schema: { type: 'array', items: scheduledStatusSchema },
            },
          },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        404: responses.notFound,
      },
    },
  },
  '/stories/whatsapp/{businessId}/{statusId}': {
    delete: {
      tags: ['Stories WhatsApp'],
      summary: 'Cancela agendamento pendente',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath, statusIdPath],
      responses: {
        200: {
          description: 'Cancelado',
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
        404: responses.notFound,
      },
    },
  },
  '/stories/whatsapp/{businessId}/series/{seriesId}': {
    delete: {
      tags: ['Stories WhatsApp'],
      summary: 'Cancela todos os agendamentos pendentes da série',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath, seriesIdPath],
      responses: {
        200: {
          description: 'Série cancelada',
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
        404: responses.notFound,
      },
    },
  },
}
