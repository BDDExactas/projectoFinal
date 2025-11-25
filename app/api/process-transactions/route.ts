import { promises as fs } from "fs"
import path from "path"
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import * as XLSX from "xlsx"
import { z } from "zod"

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

const allowedTransactionTypes = ["buy", "sell", "deposit", "withdrawal", "dividend", "interest"] as const

const normalizeDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    try {
      return XLSX.SSF.format("yyyy-mm-dd", value)
    } catch {
      return value.toString()
    }
  }
  return typeof value === "string" ? value : ""
}

const resolveFilePath = (filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)

const transactionSchema = z.object({
  fecha: z
    .preprocess(normalizeDate, z.string())
    .pipe(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe estar en formato YYYY-MM-DD")),
  cuenta: z.string().trim().min(1, "cuenta es requerida"),
  instrumento: z.string().trim().min(1, "instrumento es requerido"),
  tipo: z
    .string()
    .trim()
    .transform((val) => val.toLowerCase())
    .refine((val) => allowedTransactionTypes.includes(val as (typeof allowedTransactionTypes)[number]), {
      message: `tipo debe ser uno de: ${allowedTransactionTypes.join(", ")}`,
    }),
  cantidad: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number({ invalid_type_error: "cantidad debe ser numérica" }).finite().positive("cantidad debe ser > 0"),
  ),
  precio: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z.number().finite().optional(),
    )
    .optional(),
  total: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z.number().finite().optional(),
    )
    .optional(),
  moneda: z.string().trim().min(1, "moneda es requerida").default("ARS"),
  descripcion: z.preprocess((val) => (val === undefined ? undefined : String(val)), z.string().optional()),
})

export async function POST(request: NextRequest) {
  try {
    const { fileId, buffer, userId } = await request.json()

    if (!fileId || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const fileRecords = await sql`
      SELECT id, status, file_path, rows_processed, errors_count, error_details
      FROM imported_files
      WHERE id = ${fileId} AND user_id = ${userId}
      LIMIT 1
    `

    if (fileRecords.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const fileRecord = fileRecords[0]

    if (fileRecord.status === "completed") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        processed: fileRecord.rows_processed || 0,
        errors: fileRecord.errors_count || 0,
        errorDetails: fileRecord.error_details ? fileRecord.error_details.split("\n") : [],
      })
    }

    const bufferData =
      fileRecord.file_path
        ? await fs.readFile(resolveFilePath(fileRecord.file_path))
        : buffer
          ? Buffer.from(buffer, "base64")
          : null

    if (!bufferData) {
      return NextResponse.json({ error: "No file content available to process" }, { status: 400 })
    }

    // Update file status to processing
    await sql`
      UPDATE imported_files 
      SET status = 'processing',
          errors_count = 0,
          rows_processed = 0,
          error_details = NULL
      WHERE id = ${fileId}
    `

    // Parse Excel file
    const workbook = XLSX.read(bufferData, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]

    if (!sheetName) {
      return NextResponse.json({ error: "El archivo no contiene hojas" }, { status: 400 })
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<TransactionRow>(worksheet, { defval: "" })

    let processedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [rowIndex, row] of data.entries()) {
      try {
        const normalizedRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]))
        const validation = transactionSchema.safeParse({
          fecha: normalizedRow.fecha,
          cuenta: normalizedRow.cuenta,
          instrumento: normalizedRow.instrumento,
          tipo: normalizedRow.tipo,
          cantidad: normalizedRow.cantidad,
          precio: normalizedRow.precio,
          total: normalizedRow.total,
          moneda: normalizedRow.moneda,
          descripcion: normalizedRow.descripcion,
        })

        if (!validation.success) {
          const issues = validation.error.issues.map((i) => i.message).join("; ")
          errors.push(`Row ${rowIndex + 2} validation failed: ${issues} -> ${JSON.stringify(row)}`)
          errorCount++
          continue
        }

        const validatedRow = validation.data

        // Find or create account
        const accountResult = await sql`
          SELECT id FROM accounts 
          WHERE user_id = ${userId} AND name = ${validatedRow.cuenta}
        `

        let accountId: number
        if (accountResult.length === 0) {
          const newAccount = await sql`
            INSERT INTO accounts (user_id, name, account_type)
            VALUES (${userId}, ${validatedRow.cuenta}, 'bank_account')
            RETURNING id
          `
          accountId = newAccount[0].id
        } else {
          accountId = accountResult[0].id
        }

        // Find instrument
        const instrumentResult = await sql`
          SELECT id FROM instruments WHERE code = ${validatedRow.instrumento}
        `

        if (instrumentResult.length === 0) {
          errors.push(`Row ${rowIndex + 2}: instrument not found -> ${validatedRow.instrumento}`)
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
            ${validatedRow.fecha},
            ${validatedRow.tipo},
            ${validatedRow.cantidad},
            ${validatedRow.precio ?? null},
            ${validatedRow.total ?? null},
            ${validatedRow.moneda || "ARS"},
            ${validatedRow.descripcion || null}
          )
        `

        // Update account_instruments balance
        const existingBalance = await sql`
          SELECT quantity FROM account_instruments
          WHERE account_id = ${accountId} AND instrument_id = ${instrumentId}
        `

        const positiveTypes = ["buy", "deposit", "dividend", "interest"]
        const quantityChange = positiveTypes.includes(validatedRow.tipo) ? validatedRow.cantidad : -validatedRow.cantidad

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
        errors.push(`Row ${rowIndex + 2} processing error: ${error}`)
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
