import {
  deleteBusinessMedia,
  getDb,
  purgeLegacyWhatsAppAuthFirestore,
} from '@flowdesk/firebase'

const DEFAULT_RETENTION_DAYS = 7
const STATUS_MEDIA_RETENTION_DAYS = 2

async function deleteMessageStorage(msgData) {
  await deleteBusinessMedia(msgData.mediaUrl, msgData.mediaStoragePath).catch(() => undefined)
}

async function cleanupBusinessScheduledStatusMedia(businessId, cutoffIso, summary) {
  const db = getDb()
  const snap = await db
    .collection('businesses')
    .doc(businessId)
    .collection('scheduledStatuses')
    .get()

  for (const doc of snap.docs) {
    const row = doc.data()
    const status = String(row.status ?? '')
    if (status === 'scheduled' || status === 'publishing') continue

    const refIso = String(row.publishedAt ?? row.revokedAt ?? row.updatedAt ?? row.createdAt ?? '')
    if (!refIso || refIso >= cutoffIso) continue

    if (row.mediaStoragePath || row.mediaUrl) {
      await deleteBusinessMedia(row.mediaUrl, row.mediaStoragePath).catch(() => undefined)
      summary.deletedStatusMedia += 1
    }

    if (status === 'failed' || status === 'cancelled') {
      await doc.ref.delete().catch(() => undefined)
      summary.deletedScheduledStatuses += 1
    } else if (row.mediaStoragePath || row.mediaUrl) {
      await doc.ref
        .update({
          mediaUrl: '',
          mediaStoragePath: '',
        })
        .catch(() => undefined)
    }
  }
}

export async function runPrivacyRetentionForAllTenants(retentionDays = DEFAULT_RETENTION_DAYS) {
  const db = getDb()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const statusMediaCutoff = new Date(
    Date.now() - STATUS_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const businessesSnap = await db.collection('businesses').get()

  const summary = {
    processedBusinesses: 0,
    deletedMessages: 0,
    deletedConversations: 0,
    deletedAppointments: 0,
    deletedPayments: 0,
    deletedStatusMedia: 0,
    deletedScheduledStatuses: 0,
    migratedWaAuthFiles: 0,
  }

  summary.migratedWaAuthFiles = await purgeLegacyWhatsAppAuthFirestore().catch(() => 0)

  for (const businessDoc of businessesSnap.docs) {
    const businessId = businessDoc.id
    summary.processedBusinesses++

    const conversationsSnap = await db
      .collection('businesses')
      .doc(businessId)
      .collection('conversations')
      .get()
    for (const convDoc of conversationsSnap.docs) {
      const convData = convDoc.data()
      const lastMessageAt = String(convData.lastMessageAt ?? convData.createdAt ?? '')
      if (lastMessageAt && lastMessageAt < cutoff) {
        const messagesSnap = await convDoc.ref.collection('messages').get()
        for (const msg of messagesSnap.docs) {
          await deleteMessageStorage(msg.data())
          await msg.ref.delete()
          summary.deletedMessages++
        }
        await convDoc.ref.delete()
        summary.deletedConversations++
        continue
      }

      const oldMessagesSnap = await convDoc.ref
        .collection('messages')
        .where('createdAt', '<', cutoff)
        .get()
      for (const msg of oldMessagesSnap.docs) {
        await deleteMessageStorage(msg.data())
        await msg.ref.delete()
        summary.deletedMessages++
      }
    }

    const appointmentsSnap = await db
      .collection('businesses')
      .doc(businessId)
      .collection('appointments')
      .get()
    for (const aptDoc of appointmentsSnap.docs) {
      const apt = aptDoc.data()
      const scheduledAt = String(apt.scheduledAt ?? apt.createdAt ?? '')
      if (scheduledAt && scheduledAt < cutoff) {
        await aptDoc.ref.delete()
        summary.deletedAppointments++
      }
    }

    const paymentsSnap = await db
      .collection('businesses')
      .doc(businessId)
      .collection('payments')
      .get()
    for (const payDoc of paymentsSnap.docs) {
      const pay = payDoc.data()
      const dueDate = String(pay.dueDate ?? pay.createdAt ?? '')
      if (dueDate && dueDate < cutoff) {
        await payDoc.ref.delete()
        summary.deletedPayments++
      }
    }

    await cleanupBusinessScheduledStatusMedia(businessId, statusMediaCutoff, summary)
  }

  return summary
}
