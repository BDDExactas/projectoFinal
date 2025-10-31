import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import * as XLSX from "xlsx"

interface TransactionRow {
  fecha: string
  cuenta: string
  instrumento: string
  tipo: string
  cantidad: number
  precio?: number
  total?: number
  moneda: string
  descripcion?: string
}

export async function POST(request: NextRequest) {
  try {
    const { fileId, buffer, userId } = await request.json()

    if (!fileId || !buffer || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Update file status to processing
    await sql`
      UPDATE imported_files 
      SET status = 'processing' 
      WHERE id = ${fileId}
    `

    // Parse Excel file
    const bufferData = Buffer.from(buffer, "base64")
    const workbook = XLSX.read(bufferData, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<TransactionRow>(worksheet)

    let processedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const row of data) {
      try {
        // Validate required fields
        if (!row.fecha || !row.cuenta || !row.instrumento || !row.tipo || !row.cantidad) {
          errors.push(`Row missing required fields: ${JSON.stringify(row)}`)
          errorCount++
          continue
        }

        // Find or create account
        const accountResult = await sql`
          SELECT id FROM accounts 
          WHERE user_id = ${userId} AND name = ${row.cuenta}
        `

        let accountId: number
        if (accountResult.length === 0) {
          const newAccount = await sql`
            INSERT INTO accounts (user_id, name, account_type)
            VALUES (${userId}, ${row.cuenta}, 'bank_account')
            RETURNING id
          `
          accountId = newAccount[0].id
        } else {
          accountId = accountResult[0].id
        }

        // Find instrument
        const instrumentResult = await sql`
          SELECT id FROM instruments WHERE code = ${row.instrumento}
        `

        if (instrumentResult.length === 0) {
          errors.push(`Instrument not found: ${row.instrumento}`)
          errorCount++
          continue
        }

        const instrumentId = instrumentResult[0].id

        // Insert transaction
        await sql`
          INSERT INTO transactions (
            account_id, 
            instrument_id, 
            imported_file_id,
            transaction_date, 
            transaction_type, 
            quantity, 
            price, 
            total_amount,
            currency_code,
            description
          )
          VALUES (
            ${accountId},
            ${instrumentId},
            ${fileId},
            ${row.fecha},
            ${row.tipo.toLowerCase()},
            ${row.cantidad},
            ${row.precio || null},
            ${row.total || null},
            ${row.moneda || "ARS"},
            ${row.descripcion || null}
          )
        `

        // Update account_instruments balance
        const existingBalance = await sql`
          SELECT quantity FROM account_instruments
          WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}
        `

        const quantityChange =
          row.tipo.toLowerCase() === "buy" || row.tipo.toLowerCase() === "deposit" ? row.cantidad : -row.cantidad

        if (existingBalance.length === 0) {
          await sql`
            INSERT INTO account_instruments (account_id, instrument_id, quantity)
            VALUES (${accountId}, ${instrumentId}, ${quantityChange})
          `
        } else {
          await sql`
            UPDATE account_instruments
            SET quantity = quantity + ${quantityChange},
                updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}
          `
        }

        processedCount++
      } catch (error) {
        console.error("[v0] Transaction processing error:", error)
        errors.push(`Error processing row: ${error}`)
        errorCount++
      }
    }

    // Update file status
    await sql`
      UPDATE imported_files 
      SET status = ${errorCount === 0 ? "completed" : "failed"},
          rows_processed = ${processedCount},
          errors_count = ${errorCount},
          error_details = ${errors.join("\n")}
      WHERE id = ${fileId}
    `

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      errorDetails: errors,
    })
  } catch (error) {
    console.error("[v0] Process transactions error:", error)
    return NextResponse.json({ error: "Failed to process transactions" }, { status: 500 })
  }
}
