import {
  deleteStoryHandler,
  deleteStorySeriesHandler,
  listStoriesHandler,
  postStoriesHandler,
  postStoryRepostHandler,
} from './handler.js'

export function register(app) {
  app.get('/stories/whatsapp/:businessId', listStoriesHandler)
  app.post('/stories/whatsapp/:businessId', postStoriesHandler)
  app.post('/stories/whatsapp/:businessId/:statusId/repost', postStoryRepostHandler)
  app.delete('/stories/whatsapp/:businessId/series/:seriesId', deleteStorySeriesHandler)
  app.delete('/stories/whatsapp/:businessId/:statusId', deleteStoryHandler)
}
