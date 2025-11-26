const { readFileSync } = require('fs')
const { join } = require('path')

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    for (const line of content.split(/\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      process.env[key] = value
    }
  } catch (err) {
    // ignore if file missing
  }
}

async function main() {
  loadEnvFile(join(process.cwd(), '.env.local'))

  const neonUrl = process.env.NEON_NEON_DATABASE_URL
  if (!neonUrl) {
    console.error('NEON_NEON_DATABASE_URL not set in .env.local or environment')
    process.exit(1)
  }

  const { neon } = require('@neondatabase/serverless')
  const sql = neon(neonUrl)

  const viewsSQL = readFileSync(join(process.cwd(), 'scripts', '03-create-views.sql'), 'utf8')
  const statements = viewsSQL
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  console.log('[v0] Applying views...')
  try {
    // Drop the main view first to allow changing columns safely, then recreate.
    await sql.query('DROP VIEW IF EXISTS v_account_valuations CASCADE')

    for (const stmt of statements) {
      await sql.query(stmt)
    }
    console.log('[v0] Views applied successfully')
    process.exit(0)
  } catch (err) {
    console.error('[v0] Failed to apply views:', err)
    process.exit(1)
  }
}

main()
