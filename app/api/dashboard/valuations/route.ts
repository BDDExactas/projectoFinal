import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { AccountValuation } from "@/lib/db-types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get("userEmail")
    const accountName = searchParams.get("accountName")

    if (!userEmail) {
      return NextResponse.json({ error: "User email required" }, { status: 400 })
    }

    let valuations: AccountValuation[]

    if (accountName) {
      valuations = await sql<AccountValuation[]>`
        SELECT * FROM v_account_valuations
        WHERE user_email = ${userEmail} AND account_name = ${accountName}
        ORDER BY valuation DESC
      `
    } else {
      valuations = await sql<AccountValuation[]>`
        SELECT * FROM v_account_valuations
        WHERE user_email = ${userEmail}
        ORDER BY valuation DESC
      `
    }

    return NextResponse.json({ valuations })
  } catch (error) {
    console.error("[v0] Valuations error:", error)
    return NextResponse.json({ error: "Failed to fetch valuations" }, { status: 500 })
  }
}
