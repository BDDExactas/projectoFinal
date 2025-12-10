import { query } from "@/lib/db"

export interface UpsertInstrumentPriceInput {
  instrumentCode: string
  price: number
  currencyCode: string
  priceDate: string
  asOf?: string
}

export interface UpsertInstrumentPriceOptions extends UpsertInstrumentPriceInput {
  returning?: boolean
}

// Centralized helper to insert/update prices consistently across the app.
export async function upsertInstrumentPrice({
  instrumentCode,
  price,
  currencyCode,
  priceDate,
  asOf,
  returning = false,
}: UpsertInstrumentPriceOptions) {
  const returningClause = returning ? "RETURNING *" : ""

  return query(
    `
      INSERT INTO instrument_prices (instrument_code, price_date, price, currency_code, as_of)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (instrument_code, price_date)
      DO UPDATE SET 
        price = EXCLUDED.price,
        currency_code = EXCLUDED.currency_code,
        as_of = EXCLUDED.as_of,
        created_at = CURRENT_TIMESTAMP
      ${returningClause}
    `,
    [instrumentCode, priceDate, price, currencyCode, asOf ?? new Date().toISOString()],
  )
}
