import {
  businessIdPath,
  errorSchema,
  forceQuery,
  multipartFile,
  responses,
} from '../../../openapi/shared.js'

const sendTextBody = {
  type: 'object',
  required: ['to', 'text'],
  properties: {
    to: { type: 'string', description: 'Telefone ou JID do destinatário' },
    text: { type: 'string', description: 'Texto da mensagem' },
    conversationId: {
      type: 'string',
      description: 'Opcional — usa replyJid da conversa se informado',
    },
  },
}

const sendMediaMultipart = {
  type: 'object',
  required: ['file', 'conversationId'],
  properties: {
    file: { ...multipartFile, description: 'Imagem, vídeo ou áudio' },
    conversationId: { type: 'string' },
    text: { type: 'string', description: 'Legenda opcional' },
  },
}

const qrStatusResponse = {
  type: 'object',
  properties: {
    connected: { type: 'boolean' },
    status: { type: 'string' },
    qr: { type: 'string', description: 'Data URL do QR' },
    message: { type: 'string' },
  },
}

export const chatWhatsappPath = {
  '/chat/whatsapp/qr-code/{businessId}': {
    get: {
      tags: ['Chat WhatsApp'],
      summary: 'Status da conexão e QR Code atual',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      responses: {
        200: {
          description: 'Status da sessão',
          content: { 'application/json': { schema: qrStatusResponse } },
        },
        401: responses.unauthorized,
        503: {
          description: 'Admin ou WA não configurado',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
    post: {
      tags: ['Chat WhatsApp'],
      summary: 'Iniciar pareamento (gerar QR Code)',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath, forceQuery],
      responses: {
        200: {
          description: 'QR gerado ou já conectado',
          content: { 'application/json': { schema: qrStatusResponse } },
        },
        401: responses.unauthorized,
        500: {
          description: 'Falha ao conectar',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/chat/whatsapp/connection/{businessId}': {
    delete: {
      tags: ['Chat WhatsApp'],
      summary: 'Desconectar WhatsApp e remover sessão',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      responses: {
        200: {
          description: 'Desconectado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string', example: 'disconnected' } },
              },
            },
          },
        },
        401: responses.unauthorized,
      },
    },
  },
  '/chat/whatsapp/messages/{businessId}': {
    post: {
      tags: ['Chat WhatsApp'],
      summary: 'Enviar mensagem de texto',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: sendTextBody } },
      },
      responses: {
        200: {
          description: 'Mensagem enviada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  message: { type: 'object' },
                },
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
  '/chat/whatsapp/messages/{businessId}/media': {
    post: {
      tags: ['Chat WhatsApp'],
      summary: 'Enviar mídia em conversa',
      security: [{ bearerAuth: [] }],
      parameters: [businessIdPath],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': { schema: sendMediaMultipart },
        },
      },
      responses: {
        200: {
          description: 'Mídia enviada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  message: { type: 'object' },
                },
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
