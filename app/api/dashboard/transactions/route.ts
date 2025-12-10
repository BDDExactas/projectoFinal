import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"
import type { TransactionHistory } from "@/lib/db-types"

const paramsSchema = z.object({
  userEmail: z.string().email("User email required"),
  limit: z
    .preprocess((v) => (v === null ? undefined : v), z.string().regex(/^\d+$/).transform((v) => Number(v)))
    .optional(),
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
    const userEmail = parsed.data.userEmail
    const limitValue = parsed.data.limit && parsed.data.limit > 0 ? Math.min(parsed.data.limit, 500) : 50

    const transactions = await sql<TransactionHistory[]>`
      SELECT * FROM v_transaction_history
      WHERE account_user_email = ${userEmail}
      ORDER BY transaction_date DESC
      LIMIT ${limitValue}
    `

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("[v0] Transactions error:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}
