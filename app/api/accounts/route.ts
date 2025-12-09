import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get("userEmail")
    if (!userEmail) return NextResponse.json({ error: "userEmail es requerido" }, { status: 400 })

    const accounts = await sql`
      SELECT user_email, name, account_type, bank_name, created_at, updated_at
      FROM accounts
      WHERE user_email = ${userEmail}
      ORDER BY name ASC
    `
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("[v0] Fetch accounts error:", error)
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, name, accountType = "bank_account", bankName } = body
    if (!userEmail || !name) {
      return NextResponse.json({ error: "userEmail y name son requeridos" }, { status: 400 })
    }

    await sql`
      INSERT INTO accounts (user_email, name, account_type, bank_name)
      VALUES (${userEmail}, ${name}, ${accountType}, ${bankName ?? null})
      ON CONFLICT (user_email, name) DO NOTHING
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Create account error:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, name, newName, accountType, bankName } = body
    if (!userEmail || !name) {
      return NextResponse.json({ error: "userEmail y name son requeridos" }, { status: 400 })
    }

    const result = await sql`
      UPDATE accounts
      SET name = COALESCE(${newName}, name),
          account_type = COALESCE(${accountType}, account_type),
          bank_name = COALESCE(${bankName}, bank_name),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_email = ${userEmail} AND name = ${name}
      RETURNING name
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Update account error:", error)
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, name } = body
    if (!userEmail || !name) {
      return NextResponse.json({ error: "userEmail y name son requeridos" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM accounts
      WHERE user_email = ${userEmail} AND name = ${name}
      RETURNING name
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete account error:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
