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
                  timestamp: { type: 'string', format: 'date-time' },
                },
                required: ['status', 'timestamp'],
              },
            },
          },
        },
      },
    },
  },
}
