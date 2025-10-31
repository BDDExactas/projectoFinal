import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { InstrumentPerformance } from "@/lib/db-types"

export async function GET(request: NextRequest) {
  try {
    const performance = await sql<InstrumentPerformance[]>`
      SELECT * FROM v_instrument_performance
      WHERE current_price IS NOT NULL
      ORDER BY price_change_percent DESC
    `

    return NextResponse.json({ performance })
  } catch (error) {
    console.error("[v0] Performance error:", error)
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 })
  }
}
