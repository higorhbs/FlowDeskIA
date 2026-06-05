import { businessIdPath, errorSchema, responses } from '../../openapi/shared.js'

const timeSlot = {
  oneOf: [
    { type: 'array', items: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, minItems: 2, maxItems: 2 },
    { type: 'null' },
  ],
}

const scheduleSchema = {
  type: 'object',
  properties: {
    businessId: { type: 'string' },
    tenantId: { type: 'string' },
    timezone: { type: 'string', example: 'America/Sao_Paulo' },
    workingHours: {
      type: 'object',
      additionalProperties: timeSlot,
      description: 'Chaves: mon, tue, wed, thu, fri, sat, sun',
    },
    specialHours: {
      type: 'object',
      additionalProperties: timeSlot,
      description: 'Chaves: YYYY-MM-DD',
    },
    lunchBreak: timeSlot,
    lunchMsg: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
}

const schedulePutBody = {
  type: 'object',
  properties: {
    timezone: { type: 'string' },
    workingHours: scheduleSchema.properties.workingHours,
    specialHours: scheduleSchema.properties.specialHours,
    lunchBreak: timeSlot,
    lunchMsg: { type: 'string' },
  },
}

export const schedulePath = {
  '/schedules': {
    get: {
      tags: ['Schedule'],
      summary: 'Listar horários do tenant',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'businessId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Filtra um negócio; omitir lista todos do tenant',
        },
      ],
      responses: {
        200: {
          description: 'Lista de schedules',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  schedules: { type: 'array', items: scheduleSchema },
                },
                required: ['schedules'],
              },
            },
          },
        },
        401: responses.unauthorized,
      },
    },
  },
  '/businesses/{businessId}/schedule': {
    put: {
      tags: ['Schedule'],
      summary: 'Salvar horários do negócio',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: schedulePutBody } },
      },
      responses: {
        200: {
          description: 'Schedule salvo',
          content: { 'application/json': { schema: scheduleSchema } },
        },
        400: responses.badRequest,
        401: responses.unauthorized,
        404: responses.notFound,
      },
    },
  },
}
