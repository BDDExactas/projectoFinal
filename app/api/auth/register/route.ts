import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import type { User } from "@/lib/db-types"
import { setSessionCookie } from "@/lib/auth"

const registerSchema = z.object({
  email: z.string().email("Correo inválido"),
  name: z.string().min(1, "Nombre requerido").max(255, "Nombre demasiado largo"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128, "Contraseña demasiado larga"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const email = parsed.data.email.trim().toLowerCase()
    const name = parsed.data.name.trim()
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)

    const existing = await sql<User[]>`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe una cuenta con este correo" }, { status: 409 })
    }

    const result = await sql<User[]>`
      INSERT INTO users (email, name, password_hash)
      VALUES (${email}, ${name}, ${passwordHash})
      RETURNING id, email, name, created_at, updated_at
    `

    const user = result[0]

    const response = NextResponse.json({ user })
    setSessionCookie(response, { userId: user.id, email: user.email, name: user.name })

    return response
  } catch (error) {
    console.error("[v0] Register error:", error)
    return NextResponse.json({ error: "No se pudo crear la cuenta" }, { status: 500 })
  }
}
