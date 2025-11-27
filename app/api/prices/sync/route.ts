import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { fetchYahooQuote } from "@/lib/price-providers/yahoo"

interface InstrumentRow {
  id: number
  code: string
  external_symbol?: string
  instrument_type: string
}

const MAX_INSTRUMENTS = 50

export async function POST() {
  try {
    const instruments = await query<InstrumentRow>(
      `
        SELECT i.id, i.code, i.external_symbol, it.code AS instrument_type
        FROM instruments i
        JOIN instrument_types it ON i.instrument_type_id = it.id
        ORDER BY i.id
        LIMIT $1
      `,
      [MAX_INSTRUMENTS],
    )

    if (instruments.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No hay instrumentos cargados" })
    }

    let updated = 0
    const errors: string[] = []

    for (const instrument of instruments) {
      if (instrument.instrument_type === "cash") {
        // No quote needed for cash balances
        continue
      }

      const symbol = (instrument.external_symbol || instrument.code || "").trim()
      if (!symbol) {
        errors.push(`Sin símbolo para ${instrument.code}`)
        continue
      }

      try {
        const quote = await fetchYahooQuote(symbol)
        const currency =
          instrument.instrument_type === "cash"
            ? instrument.code
            : symbol.endsWith(".BA")
              ? "ARS"
              : quote.currency || "USD"

        await query(
          `
            INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code, as_of)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (instrument_id, price_date)
            DO UPDATE SET 
              price = EXCLUDED.price, 
              currency_code = EXCLUDED.currency_code, 
              as_of = EXCLUDED.as_of,
              created_at = CURRENT_TIMESTAMP
          `,
          [instrument.id, quote.price_date, quote.price, currency, quote.as_of],
        )
        updated++
      } catch (error) {
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : "Error desconocido"
        errors.push(`Sin precio para ${instrument.code} (${symbol}): ${message}`)
      }
    }

    const status = errors.length > 0 ? 207 : 200
    return NextResponse.json({ success: errors.length === 0, updated, errors }, { status })
  } catch (error) {
    console.error("[v0] Price sync error:", error)
    return NextResponse.json({ error: "No se pudieron sincronizar los precios" }, { status: 500 })
  }
}
