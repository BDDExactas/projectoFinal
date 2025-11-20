import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { join } from "path"

const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

async function initDatabase() {
  console.log("[v0] Starting database initialization...")

  try {
    // Read and execute schema creation
    console.log("[v0] Creating schema...")
    const schemaSQL = readFileSync(join(process.cwd(), "scripts", "01-create-schema.sql"), "utf-8")
    for (const statement of schemaSQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await sql.query(statement)
    }
    console.log("[v0] ✓ Schema created successfully")

    // Read and execute seed data
    console.log("[v0] Seeding initial data...")
    const seedSQL = readFileSync(join(process.cwd(), "scripts", "02-seed-initial-data.sql"), "utf-8")
    for (const statement of seedSQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await sql.query(statement)
    }
    console.log("[v0] ✓ Initial data seeded successfully")

    // Read and execute views creation
    console.log("[v0] Creating analytical views...")
    const viewsSQL = readFileSync(join(process.cwd(), "scripts", "03-create-views.sql"), "utf-8")
    for (const statement of viewsSQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await sql.query(statement)
    }
    console.log("[v0] ✓ Analytical views created successfully")

    console.log("[v0] Database initialization completed! 🎉")
  } catch (error) {
    console.error("[v0] Database initialization failed:", error)
    process.exit(1)
  }
}

initDatabase()
