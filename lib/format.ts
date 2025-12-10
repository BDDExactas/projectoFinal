export function formatMoney(value: number | string, currency = "ARS", locale = "es-AR", minimumFractionDigits = 2, maximumFractionDigits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return "-"
  return num.toLocaleString(locale, { minimumFractionDigits, maximumFractionDigits })
}

export function formatNumber(value: number | string, locale = "es-AR") {
  const num = Number(value)
  if (!Number.isFinite(num)) return "-"
  return num.toLocaleString(locale)
}
