const ENV_BASE = process.env.NEXT_PUBLIC_BASE_CURRENCY?.toUpperCase()

export const BASE_CURRENCY = ENV_BASE && ENV_BASE.length > 0 ? ENV_BASE : "ARS"

export type CurrencyCode = string

// Build Yahoo Finance pair symbol from quote currency to base (e.g. USD->ARS => USDARS=X)
export function buildFxSymbol(quoteCurrency: CurrencyCode, baseCurrency: CurrencyCode = BASE_CURRENCY): string | null {
  const from = quoteCurrency.toUpperCase()
  const to = baseCurrency.toUpperCase()
  if (from === to) return null
  return `${from}${to}=X`
}

export function isBaseCurrency(code: CurrencyCode, baseCurrency: CurrencyCode = BASE_CURRENCY): boolean {
  return code.toUpperCase() === baseCurrency.toUpperCase()
}

export interface CurrencyRateMap {
  [currency: string]: number
}

// Convert amount from a given currency into the configured base currency.
export function toBaseCurrency(amount: number, currency: CurrencyCode, rates: CurrencyRateMap, baseCurrency: CurrencyCode = BASE_CURRENCY): number {
  if (!Number.isFinite(amount)) return 0
  if (isBaseCurrency(currency, baseCurrency)) return amount

  const rate = rates[currency.toUpperCase()]
  if (!rate || rate <= 0) return amount // graceful fallback: return original amount if missing rate
  return amount * rate
}

export const DEFAULT_SUPPORTED_CURRENCIES: CurrencyCode[] = ["ARS", "USD", "EUR"]
