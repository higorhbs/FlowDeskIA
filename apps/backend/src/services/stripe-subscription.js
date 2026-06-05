export function getSubscriptionAccessEndIso(sub) {
  const item = sub.items?.data?.[0]
  const endUnix =
    (typeof sub.cancel_at === 'number' ? sub.cancel_at : null) ??
    (typeof sub.current_period_end === 'number' ? sub.current_period_end : null) ??
    (typeof item?.current_period_end === 'number' ? item.current_period_end : null) ??
    null
  if (typeof endUnix !== 'number') return null
  return new Date(endUnix * 1000).toISOString()
}

export function getSubscriptionCanceledAtIso(sub) {
  if (typeof sub.canceled_at !== 'number') return null
  return new Date(sub.canceled_at * 1000).toISOString()
}

export function isSubscriptionCancelPending(sub) {
  return Boolean(sub.cancel_at_period_end) || (typeof sub.cancel_at === 'number' && sub.status === 'active')
}

export function subscriptionCancelPatch(sub, tenant) {
  const cancelAtPeriodEnd = isSubscriptionCancelPending(sub)
  const patch = { cancelAtPeriodEnd }

  const accessEnd = getSubscriptionAccessEndIso(sub)
  if (accessEnd) patch.currentPeriodEnd = accessEnd

  const stripeCanceledAt = getSubscriptionCanceledAtIso(sub)
  if (stripeCanceledAt) {
    patch.canceledAt = stripeCanceledAt
  } else if (cancelAtPeriodEnd && !tenant.canceledAt) {
    patch.canceledAt = new Date().toISOString()
  }

  if (!cancelAtPeriodEnd && tenant.cancelAtPeriodEnd) {
    patch.cancelAtPeriodEnd = false
  }

  return patch
}
