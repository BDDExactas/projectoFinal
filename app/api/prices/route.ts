import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { InstrumentPrice } from "@/lib/db-types"
import { upsertInstrumentPrice } from "@/lib/price"
import { z } from "zod"

// Keep a small recent history per instrument for UI change calculations without flooding the table
const RECENT_PRICES_PER_INSTRUMENT = 5

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
}

const priceInputSchema = z.object({
  instrument_code: z.string().trim().min(1, "instrument_code es requerido"),
  price_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "price_date debe estar en formato YYYY-MM-DD"),
  price: z.number().positive("price debe ser > 0"),
  currency_code: z.string().trim().min(1, "currency_code es requerido"),
})

const priceUpdateSchema = z.object({
  instrument_code: z.string().trim().min(1, "instrument_code es requerido"),
  price_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "price_date debe estar en formato YYYY-MM-DD"),
  price: z.number().positive("price debe ser > 0"),
  currency_code: z.string().optional(),
})

const priceDeleteSchema = z.object({
  instrument_code: z.string().trim().min(1, "instrument_code es requerido"),
  price_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "price_date debe estar en formato YYYY-MM-DD"),
})

// GET - Fetch all prices with instrument details
export async function GET() {
  try {
    const prices = await sql<PriceWithInstrument[]>`
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
    `

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
    const validation = priceInputSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const { instrument_code, price, price_date, currency_code } = validation.data

    const result = await upsertInstrumentPrice({
      instrumentCode: instrument_code,
      price,
      priceDate: price_date,
      currencyCode: currency_code,
      returning: true,
    })

    return NextResponse.json({ success: true, price: (result as InstrumentPrice[])[0] })
  } catch (error) {
    console.error("[v0] Error saving price:", error)
    return NextResponse.json({ error: "Failed to save price" }, { status: 500 })
  }
}

// PUT - Update an existing price
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = priceUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const { instrument_code, price_date, price } = validation.data

    const result = await sql<InstrumentPrice[]>`
      UPDATE instrument_prices
      SET price = ${price}, as_of = CURRENT_TIMESTAMP
      WHERE instrument_code = ${instrument_code} AND price_date = ${price_date}
      RETURNING *
    `

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
    const validation = priceDeleteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const { instrument_code, price_date } = validation.data

    const result = await sql`
      DELETE FROM instrument_prices
      WHERE instrument_code = ${instrument_code} AND price_date = ${price_date}
      RETURNING instrument_code
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting price:", error)
    return NextResponse.json({ error: "Failed to delete price" }, { status: 500 })
  }
}

