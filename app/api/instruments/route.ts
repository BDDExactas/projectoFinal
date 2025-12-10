import { NextResponse, type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import type { Instrument } from "@/lib/db-types"

// GET - Fetch all instruments
export async function GET() {
  try {
    const instruments = await sql<Instrument[]>`
      SELECT 
        code,
        instrument_type_code,
        name,
        external_symbol,
        description,
        created_at
      FROM instruments
      ORDER BY code ASC
    `

    return NextResponse.json({ instruments })
  } catch (error) {
    console.error("[v0] Error fetching instruments:", error)
    return NextResponse.json({ error: "Failed to fetch instruments" }, { status: 500 })
  }
}

// POST - Create a new instrument
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, instrument_type_code, name, external_symbol, description } = body

    if (!code || !instrument_type_code || !name) {
      return NextResponse.json({ error: "code, instrument_type_code y name son requeridos" }, { status: 400 })
    }

    const result = await sql<Instrument[]>`
      INSERT INTO instruments (code, instrument_type_code, name, external_symbol, description)
      VALUES (${code}, ${instrument_type_code}, ${name}, ${external_symbol || null}, ${description || null})
      ON CONFLICT (code) DO UPDATE SET 
        instrument_type_code = ${instrument_type_code},
        name = ${name},
        external_symbol = ${external_symbol || null},
        description = ${description || null}
      RETURNING code, instrument_type_code, name, external_symbol, description, created_at
    `

    return NextResponse.json({ success: true, instrument: result[0] })
  } catch (error) {
    console.error("[v0] Error creating instrument:", error)
    return NextResponse.json({ error: "Failed to create instrument" }, { status: 500 })
  }
}

// PUT - Update an instrument
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, instrument_type_code, name, external_symbol, description } = body

    if (!code || !instrument_type_code || !name) {
      return NextResponse.json({ error: "code, instrument_type_code y name son requeridos" }, { status: 400 })
    }

    const result = await sql<Instrument[]>`
      UPDATE instruments
      SET 
        instrument_type_code = ${instrument_type_code},
        name = ${name},
        external_symbol = ${external_symbol || null},
        description = ${description || null}
      WHERE code = ${code}
      RETURNING code, instrument_type_code, name, external_symbol, description, created_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, instrument: result[0] })
  } catch (error) {
    console.error("[v0] Error updating instrument:", error)
    return NextResponse.json({ error: "Failed to update instrument" }, { status: 500 })
  }
}

// DELETE - Delete an instrument
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const code = body?.code

    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM instruments WHERE code = ${code} RETURNING code
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Instrument deleted" })
  } catch (error) {
    console.error("[v0] Error deleting instrument:", error)
    return NextResponse.json({ error: "Failed to delete instrument" }, { status: 500 })
  }
}

