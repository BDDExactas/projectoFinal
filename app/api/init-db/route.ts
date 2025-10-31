import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST() {
  try {
    console.log("[v0] Starting database initialization via API...")

    // Create schema
    await sql`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Instrument types
      CREATE TABLE IF NOT EXISTS instrument_types (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT
      );

      -- Instruments
      CREATE TABLE IF NOT EXISTS instruments (
        id SERIAL PRIMARY KEY,
        instrument_type_id INTEGER REFERENCES instrument_types(id),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Accounts
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        parent_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        account_type VARCHAR(50) NOT NULL,
        bank_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Account instruments
      CREATE TABLE IF NOT EXISTS account_instruments (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
        quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, instrument_id)
      );

      -- Instrument prices
      CREATE TABLE IF NOT EXISTS instrument_prices (
        id SERIAL PRIMARY KEY,
        instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
        price_date DATE NOT NULL,
        price DECIMAL(18, 8) NOT NULL,
        currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(instrument_id, price_date)
      );

      -- Imported files
      CREATE TABLE IF NOT EXISTS imported_files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        rows_processed INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        error_details TEXT
      );

      -- Transactions
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        instrument_id INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
        imported_file_id INTEGER REFERENCES imported_files(id) ON DELETE SET NULL,
        transaction_date DATE NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        quantity DECIMAL(18, 8) NOT NULL,
        price DECIMAL(18, 8),
        total_amount DECIMAL(18, 8),
        currency_code VARCHAR(10) NOT NULL DEFAULT 'ARS',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `

    console.log("[v0] Schema created")

    // Seed initial data
    await sql`
      INSERT INTO instrument_types (code, name, description) VALUES
        ('cash', 'Efectivo', 'Dinero en efectivo o depósitos bancarios'),
        ('bond', 'Bono', 'Títulos de deuda pública o privada'),
        ('stock', 'Acción', 'Acciones de empresas cotizadas'),
        ('other', 'Otro', 'Otros instrumentos financieros')
      ON CONFLICT (code) DO NOTHING;
    `

    await sql`
      INSERT INTO instruments (instrument_type_id, code, name, description) VALUES
        ((SELECT id FROM instrument_types WHERE code = 'cash'), 'ARS', 'Peso Argentino', 'Moneda local argentina'),
        ((SELECT id FROM instrument_types WHERE code = 'cash'), 'USD', 'Dólar Estadounidense', 'Dólar de Estados Unidos'),
        ((SELECT id FROM instrument_types WHERE code = 'cash'), 'EUR', 'Euro', 'Moneda europea'),
        ((SELECT id FROM instrument_types WHERE code = 'bond'), 'AL30', 'Bono AL30', 'Bono soberano argentino 2030'),
        ((SELECT id FROM instrument_types WHERE code = 'bond'), 'BA24C', 'Bono BA24C', 'Bono de la Ciudad de Buenos Aires 2024'),
        ((SELECT id FROM instrument_types WHERE code = 'stock'), 'YPFD', 'YPF', 'YPF Sociedad Anónima'),
        ((SELECT id FROM instrument_types WHERE code = 'stock'), 'LOMA', 'Loma Negra', 'Loma Negra C.I.A.S.A.'),
        ((SELECT id FROM instrument_types WHERE code = 'stock'), 'METRD', 'Metrogas', 'Metrogas S.A.')
      ON CONFLICT (code) DO NOTHING;
    `

    await sql`
      INSERT INTO users (email, name) VALUES
        ('demo@example.com', 'Usuario Demo')
      ON CONFLICT (email) DO NOTHING;
    `

    console.log("[v0] Initial data seeded")

    // Create views
    await sql`
      CREATE OR REPLACE VIEW v_account_valuations AS
      SELECT 
        a.id AS account_id,
        a.name AS account_name,
        a.user_id,
        u.name AS user_name,
        i.code AS instrument_code,
        i.name AS instrument_name,
        it.name AS instrument_type,
        ai.quantity,
        COALESCE(ip.price, 0) AS current_price,
        COALESCE(ai.quantity * ip.price, 0) AS valuation,
        ip.currency_code,
        ip.price_date
      FROM accounts a
      JOIN users u ON a.user_id = u.id
      JOIN account_instruments ai ON a.id = ai.account_id
      JOIN instruments i ON ai.instrument_id = i.id
      JOIN instrument_types it ON i.instrument_type_id = it.id
      LEFT JOIN LATERAL (
        SELECT price, currency_code, price_date
        FROM instrument_prices
        WHERE instrument_id = i.id
        ORDER BY price_date DESC
        LIMIT 1
      ) ip ON true
      WHERE ai.quantity > 0;
    `

    await sql`
      CREATE OR REPLACE VIEW v_portfolio_totals AS
      SELECT 
        account_id,
        account_name,
        user_id,
        user_name,
        currency_code,
        SUM(valuation) AS total_value,
        COUNT(DISTINCT instrument_code) AS instruments_count,
        MAX(price_date) AS last_price_date
      FROM v_account_valuations
      GROUP BY account_id, account_name, user_id, user_name, currency_code;
    `

    await sql`
      CREATE OR REPLACE VIEW v_transaction_history AS
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.transaction_type,
        a.name AS account_name,
        u.name AS user_name,
        i.code AS instrument_code,
        i.name AS instrument_name,
        t.quantity,
        t.price,
        t.total_amount,
        t.currency_code,
        t.description,
        if_table.filename AS source_file
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN instruments i ON t.instrument_id = i.id
      LEFT JOIN imported_files if_table ON t.imported_file_id = if_table.id
      ORDER BY t.transaction_date DESC;
    `

    await sql`
      CREATE OR REPLACE VIEW v_instrument_performance AS
      SELECT 
        i.code AS instrument_code,
        i.name AS instrument_name,
        it.name AS instrument_type,
        ip_current.price AS current_price,
        ip_current.price_date AS current_date,
        ip_previous.price AS previous_price,
        ip_previous.price_date AS previous_date,
        CASE 
          WHEN ip_previous.price > 0 THEN 
            ((ip_current.price - ip_previous.price) / ip_previous.price * 100)
          ELSE 0
        END AS price_change_percent,
        ip_current.currency_code
      FROM instruments i
      JOIN instrument_types it ON i.instrument_type_id = it.id
      LEFT JOIN LATERAL (
        SELECT price, price_date, currency_code
        FROM instrument_prices
        WHERE instrument_id = i.id
        ORDER BY price_date DESC
        LIMIT 1
      ) ip_current ON true
      LEFT JOIN LATERAL (
        SELECT price, price_date
        FROM instrument_prices
        WHERE instrument_id = i.id
          AND price_date < ip_current.price_date
        ORDER BY price_date DESC
        LIMIT 1
      ) ip_previous ON true;
    `

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
      { status: 500 },
    )
  }
}
