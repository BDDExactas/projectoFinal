import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { Instrument } from "@/lib/db-types"

// GET - Fetch all instruments
export async function GET() {
  try {
    const instruments = await query<Instrument>(`
      SELECT 
        i.id,
        i.instrument_type_id,
        i.code,
        i.name,
        i.description,
        i.created_at
      FROM instruments i
      ORDER BY i.code ASC
    `)

    return NextResponse.json({ instruments })
  } catch (error) {
    console.error("[v0] Error fetching instruments:", error)
    return NextResponse.json({ error: "Failed to fetch instruments" }, { status: 500 })
  }
}
