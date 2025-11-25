import { NextResponse } from "next/server"
import { query } from "@/lib/db"

interface InstrumentRow {
  id: number
  code: string
  external_symbol?: string
}

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY

async function fetchEquityQuote(symbol: string) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage equity responded ${res.status}`)
  const data = await res.json()
  const quote = data["Global Quote"]
  const price = quote?.["05. price"]
  const date = quote?.["07. latest trading day"]
  if (!price) throw new Error(`Sin precio para ${symbol}`)
  return {
    price: Number(price),
    price_date: date || new Date().toISOString().slice(0, 10),
    currency: quote?.["08. currency"] || "USD",
  }
}

async function fetchFxQuote(pair: string) {
  const [from, to] = pair.split("/")
  if (!from || !to) throw new Error(`Par FX inválido: ${pair}`)
  const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${encodeURIComponent(from)}&to_symbol=${encodeURIComponent(to)}&apikey=${API_KEY}&outputsize=compact`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage FX responded ${res.status}`)
  const data = await res.json()
  const series = data["Time Series FX (Daily)"]
  if (!series) throw new Error(`Sin serie FX para ${pair}`)
  const [latestDate] = Object.keys(series)
  const price = series[latestDate]?.["4. close"]
  if (!latestDate || !price) throw new Error(`Sin precio FX para ${pair}`)
  return { price: Number(price), price_date: latestDate, currency: to }
}

export async function POST() {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: "Falta ALPHA_VANTAGE_API_KEY en el entorno" }, { status: 500 })
    }

    const instruments = await query<InstrumentRow>(`
      SELECT id, code, external_symbol
      FROM instruments
      ORDER BY id
      LIMIT 50
    `)

    if (instruments.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No hay instrumentos cargados" })
    }

    let updated = 0
    const errors: string[] = []

    // Alpha Vantage free tier is 5 calls/min; we go sequential to stay under limits for small lists.
    for (const instrument of instruments) {
      const symbol = (instrument.external_symbol || instrument.code || "").trim()
      if (!symbol) {
        errors.push(`Sin símbolo para ${instrument.code}`)
        continue
      }

      try {
        const isFx = symbol.includes("/")
        const quote = isFx ? await fetchFxQuote(symbol) : await fetchEquityQuote(symbol)

        await query(
          `
            INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (instrument_id, price_date)
            DO UPDATE SET price = EXCLUDED.price, currency_code = EXCLUDED.currency_code, created_at = CURRENT_TIMESTAMP
          `,
          [instrument.id, quote.price_date, quote.price, quote.currency],
        )
        updated++
      } catch (error) {
        errors.push(`Sin precio para ${instrument.code} (${symbol}): ${error}`)
      }
    }

    const status = errors.length > 0 ? 207 : 200
    return NextResponse.json({ success: errors.length === 0, updated, errors }, { status })
  } catch (error) {
    console.error("[v0] Price sync error:", error)
    return NextResponse.json({ error: "No se pudieron sincronizar los precios" }, { status: 500 })
  }
}
