export const mercadoPagoPaths = {
  '/businesses/{id}/integrations/mercadopago': {
    get: {
      tags: ['Mercado Pago'],
      summary: 'Status da integração Mercado Pago',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Status' } },
    },
    delete: {
      tags: ['Mercado Pago'],
      summary: 'Desconectar Mercado Pago',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 204: { description: 'Removido' } },
    },
  },
  '/businesses/{id}/integrations/mercadopago/connect': {
    get: {
      tags: ['Mercado Pago'],
      summary: 'URL OAuth para conectar Mercado Pago',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: '{ url }' } },
    },
  },
  '/mercadopago/oauth/callback': {
    get: {
      tags: ['Mercado Pago'],
      summary: 'Callback OAuth Mercado Pago',
      parameters: [
        { name: 'code', in: 'query', schema: { type: 'string' } },
        { name: 'state', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 302: { description: 'Redirect painel' } },
    },
  },
}
