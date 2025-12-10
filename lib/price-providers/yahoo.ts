import YahooFinance from "yahoo-finance2"
import { toIsoDateString } from "@/lib/dates"

export interface ProviderQuote {
  price: number
  price_date: string // YYYY-MM-DD
  as_of: string // ISO timestamp
  currency?: string
}

type YahooQuoteKind = "equity" | "fx"

async function fetchYahooPrice(symbol: string, kind: YahooQuoteKind): Promise<ProviderQuote> {
  const yahooFinance = new YahooFinance()
  const quote = await yahooFinance.quote(symbol, {
    fields: [
      "regularMarketPrice",
      "regularMarketTime",
      "postMarketPrice",
      "postMarketTime",
      "preMarketPrice",
      "preMarketTime",
      "currency",
    ],
  })

  const price = Number(quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice)
  const timeCandidate = quote?.regularMarketTime ?? quote?.postMarketTime ?? quote?.preMarketTime ?? null

  if (!Number.isFinite(price) || price <= 0) {
    const label = kind === "fx" ? "precio FX" : "precio"
    throw new Error(`Yahoo Finance sin ${label} para ${symbol}`)
  }

  const asOfDate = timeCandidate instanceof Date ? timeCandidate : new Date()

  return {
    price,
    price_date: toIsoDateString(asOfDate),
    as_of: asOfDate.toISOString(),
    currency: quote?.currency,
  }
}

export const fetchYahooQuote = (symbol: string) => fetchYahooPrice(symbol, "equity")

// Fetches an FX quote (quoteCurrency/baseCurrency), returning price in baseCurrency per 1 quoteCurrency
export const fetchYahooFx = (pairSymbol: string) => fetchYahooPrice(pairSymbol, "fx")
