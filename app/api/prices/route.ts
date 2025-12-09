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
          ip.id,
          ip.instrument_id,
          ip.price_date,
          ip.price,
          ip.currency_code,
          ip.as_of,
          ip.created_at,
          i.code AS instrument_code,
          i.name AS instrument_name,
          it.code AS instrument_type,
          ROW_NUMBER() OVER (
            PARTITION BY ip.instrument_id
            ORDER BY ip.price_date DESC, ip.as_of DESC NULLS LAST, ip.created_at DESC
          ) AS rn
        FROM instrument_prices ip
        JOIN instruments i ON ip.instrument_id = i.id
        JOIN instrument_types it ON i.instrument_type_id = it.id
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
    const { instrument_id, price, price_date, currency_code } = body

    const instrumentIdNum = Number(instrument_id)

    // Validate required fields
    if (
      !price_date ||
      !currency_code ||
      !Number.isInteger(instrumentIdNum) ||
      instrumentIdNum <= 0 ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    // Insert or update price (upsert)
    const result = await query<InstrumentPrice>(
      `
      INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code, as_of)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (instrument_id, price_date)
      DO UPDATE SET 
        price = EXCLUDED.price,
        currency_code = EXCLUDED.currency_code,
        as_of = CURRENT_TIMESTAMP,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [instrumentIdNum, price_date, price, currency_code],
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
    const { price_id, price, price_date } = body

    const priceIdNum = Number(price_id)

    if (!priceIdNum || !price || !price_date || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    const result = await query<InstrumentPrice>(
      `
      UPDATE instrument_prices
      SET price = $1, price_date = $2, as_of = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `,
      [price, price_date, priceIdNum],
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
    const { price_id } = body

    const priceIdNum = Number(price_id)

    if (!priceIdNum) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await query<InstrumentPrice>(
      `
      DELETE FROM instrument_prices
      WHERE id = $1
      RETURNING id
    `,
      [priceIdNum],
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

