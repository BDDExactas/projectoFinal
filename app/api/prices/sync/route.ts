import { NextResponse } from "next/server"
import { query } from "@/lib/db"

interface InstrumentRow {
  id: number
  code: string
}

interface QuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol: string
      regularMarketPrice?: number
      currency?: string
    }>
  }
}

const YAHOO_ENDPOINT = "https://query1.finance.yahoo.com/v7/finance/quote?symbols="

async function fetchQuotes(symbols: string[]) {
  const url = `${YAHOO_ENDPOINT}${encodeURIComponent(symbols.join(","))}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Quote API responded with status ${res.status}`)
  }
  const data = (await res.json()) as QuoteResponse
  return data.quoteResponse?.result ?? []
}

export async function POST() {
  try {
    const instruments = await query<InstrumentRow>(`
      SELECT id, code
      FROM instruments
      ORDER BY id
      LIMIT 50
    `)

    if (instruments.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No hay instrumentos cargados" })
    }

    const today = new Date().toISOString().slice(0, 10)
    let updated = 0
    const errors: string[] = []

    // Fetch quotes in small batches to avoid oversized URLs and rate limits
    const batchSize = 10
    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize)
      try {
        const quotes = await fetchQuotes(batch.map((i) => i.code))
        const quoteBySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]))

        for (const instrument of batch) {
          const quote = quoteBySymbol.get(instrument.code.toUpperCase())
          if (!quote || quote.regularMarketPrice === undefined) {
            errors.push(`Sin precio para ${instrument.code}`)
            continue
          }

          const currency = quote.currency || "USD"
          await query(
            `
              INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (instrument_id, price_date)
              DO UPDATE SET price = EXCLUDED.price, currency_code = EXCLUDED.currency_code, created_at = CURRENT_TIMESTAMP
            `,
            [instrument.id, today, quote.regularMarketPrice, currency],
          )
          updated++
        }
      } catch (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error}`)
      }
    }

    return NextResponse.json({ success: true, updated, errors })
  } catch (error) {
    console.error("[v0] Price sync error:", error)
    return NextResponse.json({ error: "No se pudieron sincronizar los precios" }, { status: 500 })
  }
}
