import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"

const metaSchema = z.object({
  userEmail: z.string().email("User email required"),
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const meta = metaSchema.safeParse({ userEmail: formData.get("userEmail") })

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!meta.success) {
      return NextResponse.json(
        { error: meta.error.flatten().formErrors.join("; ") || "User email required" },
        { status: 400 },
      )
    }
    const { userEmail } = meta.data

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
    // Simply return the buffer for client-side processing
    // No need to persist file or track in database
    return NextResponse.json({
      success: true,
      buffer: Buffer.from(arrayBuffer).toString("base64"),
    })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
