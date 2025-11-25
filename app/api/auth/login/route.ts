import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import type { User } from "@/lib/db-types"
import { setSessionCookie } from "@/lib/auth"

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Contraseña inválida"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 })
    }

    const email = parsed.data.email.trim().toLowerCase()
    const password = parsed.data.password

    const users = await sql<User[]>`
      SELECT id, email, name, password_hash, created_at, updated_at
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `

    const user = users[0]

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 })
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
    setSessionCookie(response, { userId: user.id, email: user.email, name: user.name })

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 })
  }
}
