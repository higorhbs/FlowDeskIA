import { register as registerHealth } from './health/index.js'

const routeModules = [registerHealth]

export function registerRoutes(app) {
  for (const register of routeModules) {
    register(app)
  }
}
