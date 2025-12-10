import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"
import type { PortfolioTotal } from "@/lib/db-types"

const paramsSchema = z.object({
  userEmail: z.string().email("User email required"),
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

    const portfolios = await sql<PortfolioTotal[]>`
      SELECT * FROM v_portfolio_totals
      WHERE user_email = ${userEmail}
      ORDER BY total_value_base DESC NULLS LAST, total_value DESC
    `

    return NextResponse.json({ portfolios })
  } catch (error) {
    console.error("[v0] Portfolio totals error:", error)
    return NextResponse.json({ error: "Failed to fetch portfolio totals" }, { status: 500 })
  }
}
