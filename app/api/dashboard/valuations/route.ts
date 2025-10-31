import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { AccountValuation } from "@/lib/db-types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const accountId = searchParams.get("accountId")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    let valuations: AccountValuation[]

    if (accountId) {
      valuations = await sql<AccountValuation[]>`
        SELECT * FROM v_account_valuations
        WHERE user_id = ${userId} AND account_id = ${accountId}
        ORDER BY valuation DESC
      `
    } else {
      valuations = await sql<AccountValuation[]>`
        SELECT * FROM v_account_valuations
        WHERE user_id = ${userId}
        ORDER BY valuation DESC
      `
    }

    return NextResponse.json({ valuations })
  } catch (error) {
    console.error("[v0] Valuations error:", error)
    return NextResponse.json({ error: "Failed to fetch valuations" }, { status: 500 })
  }
}
