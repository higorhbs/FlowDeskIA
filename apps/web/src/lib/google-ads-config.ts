export const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
export const googleAdsConversionLabel =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() ?? "";

export function hasGoogleAdsTag() {
  return Boolean(googleAdsId);
}

export function googleAdsConversionSendTo() {
  if (!googleAdsId || !googleAdsConversionLabel) return "";
  return `${googleAdsId}/${googleAdsConversionLabel}`;
}
