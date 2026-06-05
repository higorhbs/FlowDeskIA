import { errorSchema, responses } from '../../openapi/shared.js'

const registerBody = {
  type: 'object',
  required: ['name', 'email', 'password'],
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 },
  },
}

const emailPasswordBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
  },
}

const googleBody = {
  type: 'object',
  required: ['accessToken'],
  properties: {
    accessToken: { type: 'string', description: 'OAuth access token do Google (GIS)' },
  },
}

const verifiedResponse = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'VERIFIED' },
    customToken: { type: 'string' },
    uid: { type: 'string' },
  },
  required: ['status', 'customToken', 'uid'],
}

const verificationRequired = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'VERIFICATION_REQUIRED' },
    email: { type: 'string' },
  },
}

const syncBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, description: 'Nome exibido no tenant (opcional)' },
  },
}

const profileNameBody = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 2 },
  },
}

const profileEmailBody = {
  type: 'object',
  required: ['email', 'currentPassword'],
  properties: {
    email: { type: 'string', format: 'email' },
    currentPassword: { type: 'string' },
  },
}

const profilePasswordBody = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  properties: {
    currentPassword: { type: 'string' },
    newPassword: { type: 'string', minLength: 6 },
  },
}

export const authPath = {
  '/register': {
    post: {
      tags: ['Auth'],
      summary: 'Cadastro com e-mail e senha',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: registerBody } },
      },
      responses: {
        201: {
          description: 'Verificação de e-mail necessária',
          content: { 'application/json': { schema: verificationRequired } },
        },
        400: responses.badRequest,
      },
    },
  },
  '/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login com e-mail e senha',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: emailPasswordBody } },
      },
      responses: {
        200: {
          description: 'Sessão criada',
          content: { 'application/json': { schema: verifiedResponse } },
        },
        403: {
          description: 'E-mail não verificado',
          content: { 'application/json': { schema: errorSchema } },
        },
      },
    },
  },
  '/auth/google': {
    post: {
      tags: ['Auth'],
      summary: 'Login com Google (access token)',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: googleBody } },
      },
      responses: {
        200: {
          description: 'Sessão criada',
          content: { 'application/json': { schema: verifiedResponse } },
        },
        400: responses.badRequest,
      },
    },
  },
  '/auth/resend-verification': {
    post: {
      tags: ['Auth'],
      summary: 'Reenviar e-mail de confirmação',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: emailPasswordBody } },
      },
      responses: {
        200: { description: 'E-mail reenviado' },
        400: responses.badRequest,
      },
    },
  },
  '/auth/confirm-verification': {
    post: {
      tags: ['Auth'],
      summary: 'Confirmar e-mail e obter sessão',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: emailPasswordBody } },
      },
      responses: {
        200: {
          description: 'Sessão criada',
          content: { 'application/json': { schema: verifiedResponse } },
        },
        400: responses.badRequest,
      },
    },
  },
  '/auth/resend-verification/session': {
    post: {
      tags: ['Auth'],
      summary: 'Reenviar e-mail de confirmação (Bearer)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'E-mail reenviado' },
        401: responses.unauthorized,
      },
    },
  },
  '/auth/confirm-verification/session': {
    post: {
      tags: ['Auth'],
      summary: 'Confirmar e-mail na sessão atual (Bearer)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Sessão confirmada',
          content: { 'application/json': { schema: verifiedResponse } },
        },
        401: responses.unauthorized,
      },
    },
  },
  '/auth/sync': {
    post: {
      tags: ['Auth'],
      summary: 'Criar tenant Firestore se não existir',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: false,
        content: { 'application/json': { schema: syncBody } },
      },
      responses: {
        200: { description: 'Tenant já existia' },
        201: { description: 'Tenant criado' },
        401: responses.unauthorized,
      },
    },
  },
  '/auth/profile/name': {
    patch: {
      tags: ['Auth'],
      summary: 'Atualizar nome do perfil',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: profileNameBody } },
      },
      responses: {
        200: { description: 'Nome atualizado' },
        400: responses.badRequest,
        401: responses.unauthorized,
      },
    },
  },
  '/auth/profile/email': {
    patch: {
      tags: ['Auth'],
      summary: 'Atualizar e-mail (exige senha atual)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: profileEmailBody } },
      },
      responses: {
        200: { description: 'E-mail atualizado' },
        400: responses.badRequest,
        401: responses.unauthorized,
      },
    },
  },
  '/auth/profile/password': {
    patch: {
      tags: ['Auth'],
      summary: 'Alterar senha',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: profilePasswordBody } },
      },
      responses: {
        200: { description: 'Senha alterada' },
        400: responses.badRequest,
        401: responses.unauthorized,
      },
    },
  },
}
