import { NextResponse, type NextRequest } from "next/server"
import { clearSessionCookie, getUserFromRequest, SESSION_COOKIE_NAME } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      const response = NextResponse.json({ user: null }, { status: 401 })
      if (request.cookies.get(SESSION_COOKIE_NAME)) {
        clearSessionCookie(response)
      }
      return response
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Me endpoint error:", error)
    const response = NextResponse.json({ user: null, error: "Sesión inválida" }, { status: 500 })
    clearSessionCookie(response)
    return response
  }
}
