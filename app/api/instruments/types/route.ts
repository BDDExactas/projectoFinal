import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

interface InstrumentType {
  code: string
  name: string
}

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
