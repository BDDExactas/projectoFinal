import { NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import { sql } from "@/lib/db"

function toStatements(sqlText: string) {
  return sqlText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function POST() {
  try {
    console.log("[v0] Starting database initialization via API...")

    const schemaSQL = readFileSync(join(process.cwd(), "scripts", "01-create-schema.sql"), "utf-8")
    const seedSQL = readFileSync(join(process.cwd(), "scripts", "02-seed-initial-data.sql"), "utf-8")
    const viewsSQL = readFileSync(join(process.cwd(), "scripts", "03-create-views.sql"), "utf-8")

    for (const statement of toStatements(schemaSQL)) {
      await sql.query(statement)
    }
    console.log("[v0] Schema created")

    for (const statement of toStatements(seedSQL)) {
      await sql.query(statement)
    }
    console.log("[v0] Initial data seeded")

    for (const statement of toStatements(viewsSQL)) {
      await sql.query(statement)
    }
    console.log("[v0] Views created")

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
    })
  } catch (error) {
    console.error("[v0] Database initialization error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
