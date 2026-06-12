const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

function resolveLevel(raw, fallback) {
  const key = raw?.trim().toLowerCase()
  return key && key in LEVELS ? key : fallback
}

const isProduction = process.env.NODE_ENV === 'production'
const threshold =
  LEVELS[resolveLevel(process.env.LOG_LEVEL, isProduction ? 'warn' : 'info')]

function shouldLog(level) {
  return LEVELS[level] <= threshold
}

function write(level, args) {
  if (!shouldLog(level)) return
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(...args)
}

export const log = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
}
