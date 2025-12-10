import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"
import type { InstrumentPerformance } from "@/lib/db-types"

const paramsSchema = z.object({
  userEmail: z.string().email().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = paramsSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors.join("; ") || "Parámetros inválidos" },
        { status: 400 },
      )
    }

    const { userEmail } = parsed.data

    const performance = await sql<InstrumentPerformance[]>`
      SELECT * FROM v_instrument_performance
      WHERE current_price IS NOT NULL
        ${userEmail ? sql`AND instrument_code IN (
          SELECT instrument_code FROM account_instruments
          WHERE user_email = ${userEmail} AND quantity > 0
        )` : sql``}
      ORDER BY price_change_percent DESC
    `

    return NextResponse.json({ performance })
  } catch (error) {
    console.error("[v0] Performance error:", error)
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 })
  }
}
