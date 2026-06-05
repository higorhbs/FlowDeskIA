import {
  confirmVerificationHandler,
  confirmVerificationSessionHandler,
  googleHandler,
  loginHandler,
  registerHandler,
  resendVerificationHandler,
  resendVerificationSessionHandler,
  syncHandler,
  updateProfileEmailHandler,
  updateProfileNameHandler,
  updateProfilePasswordHandler,
} from './handler.js'

export function register(app) {
  app.post('/register', registerHandler)
  app.post('/login', loginHandler)
  app.post('/auth/google', googleHandler)
  app.post('/auth/resend-verification', resendVerificationHandler)
  app.post('/auth/confirm-verification', confirmVerificationHandler)
  app.post('/auth/resend-verification/session', resendVerificationSessionHandler)
  app.post('/auth/confirm-verification/session', confirmVerificationSessionHandler)
  app.post('/auth/sync', syncHandler)
  app.patch('/auth/profile/name', updateProfileNameHandler)
  app.patch('/auth/profile/email', updateProfileEmailHandler)
  app.patch('/auth/profile/password', updateProfilePasswordHandler)
}
