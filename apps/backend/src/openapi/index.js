import { openApiInfo } from './document.js'
import { healthPath } from '../routes/health/openapi.js'

const pathModules = [healthPath]

export function getOpenApiDocument() {
  return {
    ...openApiInfo,
    paths: Object.assign({}, ...pathModules),
  }
}
