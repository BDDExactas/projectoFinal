import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { PortfolioTotal } from "@/lib/db-types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const portfolios = await sql<PortfolioTotal[]>`
      SELECT * FROM v_portfolio_totals
      WHERE user_id = ${userId}
      ORDER BY total_value DESC
    `

    return NextResponse.json({ portfolios })
  } catch (error) {
    console.error("[v0] Portfolio totals error:", error)
    return NextResponse.json({ error: "Failed to fetch portfolio totals" }, { status: 500 })
  }
}
