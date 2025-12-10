import { NextResponse, type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { z } from "zod"

interface InstrumentType {
  code: string
  name: string
}

const instrumentTypeSchema = z.object({
  code: z.string().trim().min(1, "code es requerido").max(20, "code muy largo").toLowerCase(),
  name: z.string().trim().min(1, "name es requerido").max(255, "name muy largo"),
})

type InstrumentTypeInput = z.infer<typeof instrumentTypeSchema>

// GET - Fetch all instrument types
export async function GET() {
  try {
    const types = await sql<InstrumentType[]>`
      SELECT code, name
      FROM instrument_types
      ORDER BY name ASC
    `

    return NextResponse.json({ types })
  } catch (error) {
    console.error("[v0] Error fetching instrument types:", error)
    return NextResponse.json({ error: "Failed to fetch instrument types" }, { status: 500 })
  }
}

// POST - Create a new instrument type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = instrumentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const { code, name } = validation.data

    const result = await sql<InstrumentType[]>`
      INSERT INTO instrument_types (code, name)
      VALUES (${code}, ${name})
      ON CONFLICT (code) DO UPDATE SET name = ${name}
      RETURNING code, name
    `

    return NextResponse.json({ success: true, type: result[0] })
  } catch (error) {
    console.error("[v0] Error creating instrument type:", error)
    const errorMsg = error instanceof Error ? error.message : "Failed to create instrument type"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

// PUT - Update an instrument type
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = instrumentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const { code, name } = validation.data

    const result = await sql<InstrumentType[]>`
      UPDATE instrument_types
      SET name = ${name}
      WHERE code = ${code}
      RETURNING code, name
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Instrument type not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, type: result[0] })
  } catch (error) {
    console.error("[v0] Error updating instrument type:", error)
    return NextResponse.json({ error: "Failed to update instrument type" }, { status: 500 })
  }
}

// DELETE - Delete an instrument type
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const code = body?.code

    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM instrument_types WHERE code = ${code} RETURNING code
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Instrument type not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Instrument type deleted" })
  } catch (error) {
    console.error("[v0] Error deleting instrument type:", error)
    const errorMsg = error instanceof Error ? error.message : "Failed to delete instrument type"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
