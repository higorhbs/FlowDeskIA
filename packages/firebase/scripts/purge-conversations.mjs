import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = resolve(__dirname, '../../../apps/web/.env')
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 1) continue
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    val = val.replace(/\\n/g, '\n')
    process.env[key] = val
  }
}

function initFirebase() {
  loadEnv()
  if (getApps().length) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Credenciais Firebase ausentes em apps/web/.env')
  }
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  })
}

async function purgeAllConversations() {
  initFirebase()
  const db = getFirestore()
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET)

  const summary = {
    businesses: 0,
    conversations: 0,
    mediaFiles: 0,
    botLocks: 0,
  }

  const businessesSnap = await db.collection('businesses').get()
  for (const businessDoc of businessesSnap.docs) {
    summary.businesses++
    const businessId = businessDoc.id
    const businessRef = businessDoc.ref

    const [chatFiles] = await bucket.getFiles({
      prefix: `businesses/${businessId}/media/chat/`,
    })
    if (chatFiles.length) {
      await Promise.all(chatFiles.map((f) => f.delete().catch(() => undefined)))
      summary.mediaFiles += chatFiles.length
    }

    const locksSnap = await businessRef.collection('botLocks').get()
    if (!locksSnap.empty) {
      const batch = db.batch()
      for (const lock of locksSnap.docs) batch.delete(lock.ref)
      await batch.commit()
      summary.botLocks += locksSnap.size
    }

    const convSnap = await businessRef.collection('conversations').get()
    for (const convDoc of convSnap.docs) {
      await db.recursiveDelete(convDoc.ref)
      summary.conversations++
    }
  }

  return summary
}

purgeAllConversations()
  .then((summary) => {
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2))
  })
  .catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err?.message ?? String(err) }))
    process.exit(1)
  })
