import { createApp } from '../src/app.js'

const app = createApp()

function hasBody(method) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

async function readBody(req) {
  if (!hasBody(req.method)) return undefined
  if (req.rawBody instanceof Buffer) return req.rawBody
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body != null && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body))
  }
  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength === 0) return Buffer.alloc(0)
  return new Promise((resolve, reject) => {
    const chunks = []
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Request body read timeout'))
    }, 10_000)
    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
    }
    const onData = (chunk) => chunks.push(chunk)
    const onEnd = () => {
      cleanup()
      resolve(Buffer.concat(chunks))
    }
    const onError = (err) => {
      cleanup()
      reject(err)
    }
    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    req.resume()
  })
}

function toHeaders(req) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else {
      headers.set(key, value)
    }
  }
  return headers
}

function writeResponse(res, response) {
  res.statusCode = response.status
  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length) {
    res.setHeader('set-cookie', cookies)
  }
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    res.setHeader(key, value)
  })
  if (!response.body) {
    res.end()
    return
  }
  return response.arrayBuffer().then((buffer) => {
    res.end(Buffer.from(buffer))
  })
}

export default async function handler(req, res) {
  const host = req.headers.host || 'localhost'
  const url = new URL(req.url || '/', `https://${host}`)
  const body = await readBody(req)
  const init = { method: req.method, headers: toHeaders(req) }
  if (body?.length) init.body = body
  const response = await app.fetch(new Request(url, init))
  await writeResponse(res, response)
}
