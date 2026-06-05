function isBaileysTimeout(err) {
  if (!err || typeof err !== 'object') return false
  const message = err instanceof Error ? err.message : err.message
  if (message !== 'Timed Out') return false
  const statusCode = err.output?.statusCode ?? err.statusCode
  return statusCode === 408
}

export function installProcessGuards() {
  process.on('unhandledRejection', (reason) => {
    if (isBaileysTimeout(reason)) {
      console.error('[backend] baileys timeout ignorado (unhandledRejection)')
      return
    }
    console.error('[backend] unhandledRejection:', reason)
  })

  process.on('uncaughtException', (err) => {
    if (isBaileysTimeout(err)) {
      console.error('[backend] baileys timeout ignorado (uncaughtException)')
      return
    }
    console.error('[backend] uncaughtException:', err)
    process.exit(1)
  })
}
