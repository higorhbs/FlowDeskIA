import './load-env.js'

export const env = {
  port: Number(process.env.PORT ?? 3001),
  firebaseWebApiKey:
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    '',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '',
  webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000',
}
