import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { InstrumentPrice } from "@/lib/db-types"

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
}

// GET - Fetch all prices with instrument details
export async function GET() {
  try {
    const prices = await query<PriceWithInstrument>(`
      SELECT 
        ip.id,
        ip.instrument_id,
        ip.price_date,
        ip.price,
        ip.currency_code,
        ip.as_of,
        ip.created_at,
        i.code as instrument_code,
        i.name as instrument_name,
        it.code as instrument_type
      FROM instrument_prices ip
      JOIN instruments i ON ip.instrument_id = i.id
      JOIN instrument_types it ON i.instrument_type_id = it.id
      ORDER BY ip.as_of DESC, ip.price_date DESC, i.code ASC
      LIMIT 100
    `)

    return NextResponse.json({ prices })
  } catch (error) {
    console.error("[v0] Error fetching prices:", error)
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 })
  }
}

// POST - Add or update a price
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { instrument_id, price, price_date, currency_code } = body

    // Validate required fields
    if (!instrument_id || !price || !price_date || !currency_code) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Insert or update price (upsert)
    const result = await query<InstrumentPrice>(
      `
      INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (instrument_id, price_date)
      DO UPDATE SET 
        price = EXCLUDED.price,
        currency_code = EXCLUDED.currency_code,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [instrument_id, price_date, price, currency_code],
    )

    return NextResponse.json({ success: true, price: result[0] })
  } catch (error) {
    console.error("[v0] Error saving price:", error)
    return NextResponse.json({ error: "Failed to save price" }, { status: 500 })
  }
}
