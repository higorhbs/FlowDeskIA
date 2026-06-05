export const healthPath = {
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      responses: {
        200: {
          description: 'Service is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  ok: { type: 'boolean', example: true },
                  ts: { type: 'string', format: 'date-time' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/health/admin': {
    get: {
      tags: ['System'],
      summary: 'Firebase Admin credential status',
      responses: {
        200: {
          description: 'Admin SDK status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  adminConfigured: { type: 'boolean' },
                  projectId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  },
  '/health/payments': {
    get: {
      tags: ['System'],
      summary: 'Asaas platform configuration status',
      responses: {
        200: {
          description: 'Payment provider status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  asaasConfigured: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  },
}
