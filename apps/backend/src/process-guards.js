import { log } from './lib/log.js'

const WA_CONSOLE_NOISE =
  /Bad MAC|Session error|MessageCounterError|Key used already or never filled|No matching sessions found|failed to decrypt|Closing session|Decrypted message with closed session|Closing open session|SessionEntry|_chains|currentRatchet|pendingPreKey|registrationId|ephemeralKeyPair|privKey|pubKey|indexInfo|rootKey|chainKey|chainType|messageKeys|Buffer /i

const WA_CONSOLE_LINE_NOISE =
  /^\s*[_}]|^\s*'[A-Za-z0-9+/]+':|^\s*},\s*$|^\s*}\s*$|^\s*<Buffer/i

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
    /Bad MAC|Session error|MessageCounterError|Key used already or never filled|no session record|No matching sessions|failed to decrypt/i.test(
      message
    ) || /SessionError|MessageCounterError/.test(name)
  )
}

function shouldMuteConsoleArgs(args) {
  const text = args
    .map((a) => {
      if (typeof a === 'string') return a
      if (a && typeof a === 'object') {
        if ('_chains' in a || 'currentRatchet' in a || 'pendingPreKey' in a) return 'SessionEntry'
        if (Buffer.isBuffer(a)) return 'Buffer'
        try {
          return JSON.stringify(a)
        } catch {
          return ''
        }
      }
      return ''
    })
    .join(' ')
  if (WA_CONSOLE_NOISE.test(text)) return true
  if (args.length === 1 && typeof args[0] === 'string' && WA_CONSOLE_LINE_NOISE.test(args[0])) {
    return true
  }
  return false
}

function patchConsoleForWaNoise() {
  let muteLines = 0
  for (const method of ['log', 'warn', 'error']) {
    const orig = console[method].bind(console)
    console[method] = (...args) => {
      if (muteLines > 0) {
        muteLines--
        return
      }
      if (shouldMuteConsoleArgs(args)) {
        const joined = args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
        if (/Closing session|SessionEntry/i.test(joined)) muteLines = 24
        return
      }
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
