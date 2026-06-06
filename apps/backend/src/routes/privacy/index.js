import {
  privacyConsentHandler,
  privacyDeleteAccountHandler,
  privacyExportHandler,
} from './handler.js'

export function register(app) {
  app.get('/privacy/export', privacyExportHandler)
  app.post('/privacy/consent', privacyConsentHandler)
  app.post('/privacy/delete-account', privacyDeleteAccountHandler)
}
