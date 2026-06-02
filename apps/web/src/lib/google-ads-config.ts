export const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";

export function hasGoogleAdsTag() {
  return Boolean(googleAdsId);
}
