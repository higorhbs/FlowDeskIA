import { listSchedulesHandler, putScheduleHandler } from './handler.js'

export function register(app) {
  app.get('/schedules', listSchedulesHandler)
  app.put('/businesses/:businessId/schedule', putScheduleHandler)
}
