import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { TransactionHistory } from "@/lib/db-types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const limit = searchParams.get("limit") || "50"

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const transactions = await sql<TransactionHistory[]>`
      SELECT * FROM v_transaction_history
      WHERE user_name IN (SELECT name FROM users WHERE id = ${userId})
      ORDER BY transaction_date DESC
      LIMIT ${limit}
    `

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("[v0] Transactions error:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}
