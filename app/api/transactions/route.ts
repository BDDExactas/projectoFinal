import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, accountId, instrumentCode, type, quantity, price, date, description, currency } = body

    if (!userId || !accountId || !instrumentCode || !type || !quantity) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const ttype = String(type).toLowerCase()
    const allowed = ["buy", "sell", "deposit", "withdrawal", "dividend", "interest"]
    if (!allowed.includes(ttype)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 })
    }

    // Find instrument
    const instrumentRes = await sql`SELECT id FROM instruments WHERE code = ${instrumentCode} LIMIT 1`
    if (instrumentRes.length === 0) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
    }
    const instrumentId = instrumentRes[0].id

    // Optionally insert price
    if (price !== undefined && price !== null && Number.isFinite(Number(price)) && Number(price) > 0) {
      await sql`
        INSERT INTO instrument_prices (instrument_id, price_date, price, currency_code, as_of)
        VALUES (${instrumentId}, ${date || new Date().toISOString().slice(0, 10)}, ${Number(price)}, ${currency || 'ARS'}, CURRENT_TIMESTAMP)
        ON CONFLICT (instrument_id, price_date) DO UPDATE SET price = EXCLUDED.price, currency_code = EXCLUDED.currency_code, as_of = CURRENT_TIMESTAMP, created_at = CURRENT_TIMESTAMP
      `
    }

    // Insert transaction
    await sql`
      INSERT INTO transactions (account_id, instrument_id, transaction_date, transaction_type, quantity, price, total_amount, currency_code, description)
      VALUES (
        ${accountId},
        ${instrumentId},
        ${date || new Date().toISOString().slice(0, 10)},
        ${ttype},
        ${Number(quantity)},
        ${price ?? null},
        ${price ? Number(price) * Number(quantity) : null},
        ${currency ?? 'ARS'},
        ${description ?? null}
      )
    `

    // Update account_instruments
    const existing = await sql`
      SELECT quantity FROM account_instruments WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}
    `

    const positiveTypes = ["buy", "deposit", "dividend", "interest"]
    const qtyChange = positiveTypes.includes(ttype) ? Number(quantity) : -Number(quantity)

    if (existing.length === 0) {
      await sql`INSERT INTO account_instruments (account_id, instrument_id, quantity) VALUES (${accountId}, ${instrumentId}, ${qtyChange})`
    } else {
      await sql`UPDATE account_instruments SET quantity = quantity + ${qtyChange}, updated_at = CURRENT_TIMESTAMP WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Create transaction error:", error)
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
  }
}

// DELETE - Remove a holding (account_instrument)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, accountId, instrumentId } = body

    if (!userId || !accountId || !instrumentId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM account_instruments
      WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete holding error:", error)
    return NextResponse.json({ error: "Failed to delete holding" }, { status: 500 })
  }
}
