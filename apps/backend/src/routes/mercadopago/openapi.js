export const mercadoPagoPaths = {
  '/businesses/{id}/integrations/mercadopago': {
    get: {
      tags: ['Mercado Pago'],
      summary: 'Status da integração Mercado Pago',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Status' } },
    },
    put: {
      tags: ['Mercado Pago'],
      summary: 'Salvar Access Token / Public Key do negócio',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                publicKey: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Salvo' } },
    },
    delete: {
      tags: ['Mercado Pago'],
      summary: 'Remover chaves Mercado Pago',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 204: { description: 'Removido' } },
    },
  },
}
