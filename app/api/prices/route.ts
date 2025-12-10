import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { InstrumentPrice } from "@/lib/db-types"
import { upsertInstrumentPrice } from "@/lib/price"
import { normalizeDate } from "@/lib/dates"

// Keep a small recent history per instrument for UI change calculations without flooding the table
const RECENT_PRICES_PER_INSTRUMENT = 5

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
}

const parsePricePayload = (body: any, requireCurrency = true) => {
  const instrument_code = typeof body?.instrument_code === "string" ? body.instrument_code.trim() : ""
  const currency_code = typeof body?.currency_code === "string" ? body.currency_code.trim() : ""
  const price_date = normalizeDate(body?.price_date)
  const price = Number(body?.price)

  if (!instrument_code || !price_date || (requireCurrency && !currency_code)) {
    return { ok: false, message: "Missing required fields" } as const
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "price must be a positive number" } as const
  }

  return { ok: true, data: { instrument_code, currency_code, price_date, price } } as const
}

const parsePriceKeyPayload = (body: any) => {
  const instrument_code = typeof body?.instrument_code === "string" ? body.instrument_code : undefined
  const price_date = body?.price_date

  if (!instrument_code || !price_date) {
    return { ok: false, message: "Missing required fields" } as const
  }

  return { ok: true, data: { instrument_code, price_date } } as const
}

type PricePayload = ReturnType<typeof parsePricePayload>["data"]

interface PriceHandlerOptions {
  requireCurrency: boolean
  onSuccess: (data: PricePayload) => Promise<NextResponse>
  errorLabel: string
  errorMessage: string
}

const handlePriceRequest = async (request: NextRequest, options: PriceHandlerOptions) => {
  const { requireCurrency, onSuccess, errorLabel, errorMessage } = options
  try {
    const body = await request.json()
    const parsed = parsePricePayload(body, requireCurrency)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 })
    }

    return await onSuccess(parsed.data)
  } catch (error) {
    console.error(errorLabel, error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
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
  return handlePriceRequest(request, {
    requireCurrency: true,
    errorLabel: "[v0] Error saving price:",
    errorMessage: "Failed to save price",
    onSuccess: async ({ instrument_code, price, price_date, currency_code }) => {
      const result = await upsertInstrumentPrice({
        instrumentCode: instrument_code,
        price,
        priceDate: price_date,
        currencyCode: currency_code,
        returning: true,
      })

      return NextResponse.json({ success: true, price: (result as InstrumentPrice[])[0] })
    },
  })
}

// PUT - Update an existing price
export async function PUT(request: NextRequest) {
  return handlePriceRequest(request, {
    requireCurrency: false,
    errorLabel: "[v0] Error updating price:",
    errorMessage: "Failed to update price",
    onSuccess: async ({ instrument_code, price_date, price }) => {
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
    },
  })
}

// DELETE - Remove a price
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = parsePriceKeyPayload(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 })
    }

    const { instrument_code, price_date } = parsed.data

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
