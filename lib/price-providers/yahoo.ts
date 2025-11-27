import YahooFinance from "yahoo-finance2"

export interface ProviderQuote {
  price: number
  price_date: string // YYYY-MM-DD
  as_of: string // ISO timestamp
  currency?: string
}

export async function fetchYahooQuote(symbol: string): Promise<ProviderQuote> {
  const yahooFinance = new YahooFinance()
  const quote = await yahooFinance.quote(symbol, {
    fields: ["regularMarketPrice", "regularMarketTime", "postMarketPrice", "postMarketTime", "preMarketPrice", "preMarketTime", "currency"],
  })

  const price = Number(quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice)
  const timeCandidate =
    quote?.regularMarketTime ?? quote?.postMarketTime ?? quote?.preMarketTime ?? null

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Yahoo Finance sin precio para ${symbol}`)
  }

  const asOfDate = timeCandidate instanceof Date ? timeCandidate : new Date()

  return {
    price,
    price_date: asOfDate.toISOString().slice(0, 10),
    as_of: asOfDate.toISOString(),
    currency: quote?.currency,
  }
}
