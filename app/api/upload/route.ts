import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = formData.get("userId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 },
      )
    }

    // Use the system temporary directory on serverless hosts (e.g. Vercel)
    // Writing to process.cwd() may fail on hosted platforms with read-only filesystem.
    const uploadsDir = path.join(os.tmpdir(), "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })

    // Convert file to buffer for processing and hashing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = crypto.createHash("sha256").update(buffer).digest("hex")
    const extension = path.extname(file.name) || ".xlsx"
    const savedFilename = `${hash}${extension}`
    const absolutePath = path.join(uploadsDir, savedFilename)
    // Store absolute path in DB so the processor can read it directly when available
    const storedPath = absolutePath

    // Idempotency: if same hash already uploaded by this user, reuse the record
    const existing = await sql`
      SELECT id, filename, upload_date, status, rows_processed, errors_count, error_details
      FROM imported_files
      WHERE user_id = ${userId} AND file_path = ${storedPath}
      LIMIT 1
    `

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        file: existing[0],
        filePath: relativePath,
        buffer: buffer.toString("base64"),
      })
    }

    // Persist the file server-side
    await fs.writeFile(absolutePath, buffer)

    // Create file record in database
    const result = await sql`
      INSERT INTO imported_files (user_id, filename, status, file_path)
      VALUES (${userId}, ${file.name}, 'pending', ${storedPath})
      RETURNING id, filename, upload_date, status, file_path
    `

    const fileRecord = result[0]

    return NextResponse.json({
      success: true,
      file: fileRecord,
      filePath: storedPath,
      buffer: buffer.toString("base64"), // Send buffer for client-side processing
    })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
