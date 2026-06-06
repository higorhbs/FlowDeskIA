import { handle } from 'hono/vercel'
import { createApp } from '../src/app.js'

export default handle(createApp())
