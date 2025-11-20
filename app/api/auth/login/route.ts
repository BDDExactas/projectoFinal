import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { sql } from "@/lib/db"
import type { User } from "@/lib/db-types"
import { setSessionCookie } from "@/lib/auth"

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  name: z.string().min(1, "Nombre requerido").max(255, "Nombre demasiado largo"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    const email = parsed.data.email.trim().toLowerCase()
    const name = parsed.data.name.trim()

    const result = await sql<User[]>`
      INSERT INTO users (email, name)
      VALUES (${email}, ${name})
      ON CONFLICT (email) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = CURRENT_TIMESTAMP
      RETURNING id, email, name, created_at, updated_at
    `

    const user = result[0]

    const response = NextResponse.json({ user })
    setSessionCookie(response, { userId: user.id, email: user.email, name: user.name })

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 })
  }
}
