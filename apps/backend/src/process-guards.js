import { log } from './lib/log.js'

const WA_CONSOLE_NOISE =
  /Bad MAC|Session error|MessageCounterError|Key used already or never filled|failed to decrypt|Closing session|Decrypted message with closed session|Closing open session|SessionEntry|_chains|currentRatchet|pendingPreKey|@lid/i

function isBaileysTimeout(err) {
  if (!err || typeof err !== 'object') return false
  const message = err instanceof Error ? err.message : err.message
  if (message !== 'Timed Out') return false
  const statusCode = err.output?.statusCode ?? err.statusCode
  return statusCode === 408
}

function isBaileysSessionNoise(err) {
  const message =
    err instanceof Error ? err.message : String(err?.message ?? err ?? '')
  const name = err && typeof err === 'object' ? String(err.name ?? '') : ''
  return (
    /Bad MAC|Session error|MessageCounterError|Key used already or never filled|no session record|failed to decrypt/i.test(
      message
    ) || name === 'MessageCounterError'
  )
}

function shouldMuteConsoleArgs(args) {
  const text = args
    .map((a) => {
      if (typeof a === 'string') return a
      if (a && typeof a === 'object') {
        if ('_chains' in a || 'currentRatchet' in a || 'pendingPreKey' in a) return 'SessionEntry'
        try {
          return JSON.stringify(a)
        } catch {
          return ''
        }
      }
      return ''
    })
    .join(' ')
  return WA_CONSOLE_NOISE.test(text)
}

function patchConsoleForWaNoise() {
  for (const method of ['log', 'warn', 'error']) {
    const orig = console[method].bind(console)
    console[method] = (...args) => {
      if (shouldMuteConsoleArgs(args)) return
      orig(...args)
    }
  }
}

export function installProcessGuards() {
  patchConsoleForWaNoise()

  process.on('unhandledRejection', (reason) => {
    if (isBaileysTimeout(reason) || isBaileysSessionNoise(reason)) {
      log.debug('[backend] baileys noise ignorado (unhandledRejection)')
      return
    }
    log.error('[backend] unhandledRejection:', reason)
  })

  process.on('uncaughtException', (err) => {
    if (isBaileysTimeout(err) || isBaileysSessionNoise(err)) {
      log.debug('[backend] baileys noise ignorado (uncaughtException)')
      return
    }
    log.error('[backend] uncaughtException:', err)
    process.exit(1)
  })
}
