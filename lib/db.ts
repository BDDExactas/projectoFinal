import { neon } from "@neondatabase/serverless"

// Create SQL client using Neon environment variable. If the env var is missing,
// export a stub that throws a helpful error when any DB call is attempted.
const neonUrl = process.env.NEON_NEON_DATABASE_URL
export const sql: any = neonUrl
  ? neon(neonUrl)
  : (() => {
      throw new Error(
        "No database connection string was provided to `neon()`. Please set NEON_NEON_DATABASE_URL in `.env.local` or your environment."
      )
    })

// Helper function to execute queries
export async function query<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  try {
    const result = await sql(queryText, params)
    return result as T[]
  } catch (error) {
    console.error("[v0] Database query error:", error)
    throw error
  }
}
