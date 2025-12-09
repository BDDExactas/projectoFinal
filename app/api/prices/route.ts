import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { InstrumentPrice } from "@/lib/db-types"

// Keep a small recent history per instrument for UI change calculations without flooding the table
const RECENT_PRICES_PER_INSTRUMENT = 5

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
}

// GET - Fetch all prices with instrument details
export async function GET() {
  try {
    const prices = await query<PriceWithInstrument>(`
      WITH ranked_prices AS (
        SELECT
          ip.instrument_code,
          ip.price_date,
          ip.price,
          ip.currency_code,
          ip.as_of,
          ip.created_at,
          i.name AS instrument_name,
          it.code AS instrument_type,
          ROW_NUMBER() OVER (
            PARTITION BY ip.instrument_code
            ORDER BY ip.price_date DESC, ip.as_of DESC NULLS LAST, ip.created_at DESC
          ) AS rn
        FROM instrument_prices ip
        JOIN instruments i ON ip.instrument_code = i.code
        JOIN instrument_types it ON i.instrument_type_code = it.code
      )
      SELECT *
      FROM ranked_prices
      WHERE rn <= ${RECENT_PRICES_PER_INSTRUMENT}
      ORDER BY price_date DESC, as_of DESC NULLS LAST, created_at DESC, instrument_code ASC
      LIMIT ${RECENT_PRICES_PER_INSTRUMENT * 60}
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
    const { instrument_code, price, price_date, currency_code } = body

    // Validate required fields
    if (
      !price_date ||
      !currency_code ||
      !instrument_code ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    // Insert or update price (upsert)
    const result = await query<InstrumentPrice>(
      `
      INSERT INTO instrument_prices (instrument_code, price_date, price, currency_code, as_of)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (instrument_code, price_date)
      DO UPDATE SET 
        price = EXCLUDED.price,
        currency_code = EXCLUDED.currency_code,
        as_of = CURRENT_TIMESTAMP,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [instrument_code, price_date, price, currency_code],
    )

    return NextResponse.json({ success: true, price: result[0] })
  } catch (error) {
    console.error("[v0] Error saving price:", error)
    return NextResponse.json({ error: "Failed to save price" }, { status: 500 })
  }
}

// PUT - Update an existing price
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { instrument_code, price_date, price } = body

    if (!instrument_code || !price_date || !price || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    const result = await query<InstrumentPrice>(
      `
      UPDATE instrument_prices
      SET price = $1, price_date = $2, as_of = CURRENT_TIMESTAMP
      WHERE instrument_code = $3 AND price_date = $4
      RETURNING *
    `,
      [price, price_date, instrument_code, price_date],
    )

    if (result.length === 0) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, price: result[0] })
  } catch (error) {
    console.error("[v0] Error updating price:", error)
    return NextResponse.json({ error: "Failed to update price" }, { status: 500 })
  }
}

// DELETE - Remove a price
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { instrument_code, price_date } = body

    if (!instrument_code || !price_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await query<InstrumentPrice>(
      `
      DELETE FROM instrument_prices
      WHERE instrument_code = $1 AND price_date = $2
      RETURNING instrument_code
    `,
      [instrument_code, price_date],
    )

    if (result.length === 0) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting price:", error)
    return NextResponse.json({ error: "Failed to delete price" }, { status: 500 })
  }
}
