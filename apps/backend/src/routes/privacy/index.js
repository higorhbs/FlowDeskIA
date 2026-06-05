import {
  privacyAnonymizeHandler,
  privacyConsentHandler,
  privacyDeleteAccountHandler,
  privacyExportHandler,
  privacyRequestsHandler,
  privacyRetentionRunHandler,
} from './handler.js'

export function register(app) {
  app.get('/privacy/export', privacyExportHandler)
  app.post('/privacy/consent', privacyConsentHandler)
  app.post('/privacy/requests', privacyRequestsHandler)
  app.post('/privacy/delete-account', privacyDeleteAccountHandler)
  app.post('/privacy/anonymize', privacyAnonymizeHandler)
  app.post('/privacy/retention/run', privacyRetentionRunHandler)
}
