import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"
import type { AccountValuation } from "@/lib/db-types"

const paramsSchema = z.object({
  userEmail: z.string().email("User email required"),
  accountName: z.string().trim().optional(),
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
    const { userEmail, accountName } = parsed.data

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
