import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { applyWaPathDefaults } from './wa-paths.js'

const configDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(configDir, '../..')

function loadEnvFile(filePath, override = false) {
  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function resolveCredentialPaths() {
  const credKeys = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_PATH']
  for (const key of credKeys) {
    const raw = process.env[key]?.trim()
    if (!raw || raw.startsWith('/')) continue
    const resolved = resolve(backendRoot, raw)
    if (existsSync(resolved)) process.env[key] = resolved
  }
}

export function loadBackendEnv() {
  const localEnv = resolve(backendRoot, '.env')
  if (existsSync(localEnv)) loadEnvFile(localEnv, true)
  resolveCredentialPaths()
  applyWaPathDefaults()
}

loadBackendEnv()
