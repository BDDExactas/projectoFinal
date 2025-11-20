import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import type { User } from "@/lib/db-types"

const SESSION_COOKIE_NAME = "session_token"
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

interface SessionPayload {
  userId: number
  email: string
  name: string
}

const baseCookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

function requireSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error("SESSION_SECRET is not set")
  }
  return secret
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function base64UrlDecode(value: string) {
  const padLength = (4 - (value.length % 4)) % 4
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength)
  return Buffer.from(normalized, "base64").toString("utf8")
}

function signSession(payload: SessionPayload) {
  const secret = requireSessionSecret()
  const payloadString = JSON.stringify(payload)
  const signature = createHmac("sha256", secret).update(payloadString).digest("hex")
  const encodedPayload = base64UrlEncode(payloadString)
  return `${encodedPayload}.${signature}`
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encodedPayload, signature] = token.split(".")
    if (!encodedPayload || !signature) return null

    const payloadString = base64UrlDecode(encodedPayload)
    const expectedSignature = createHmac("sha256", requireSessionSecret())
      .update(payloadString)
      .digest("hex")

    const providedBuffer = Buffer.from(signature, "hex")
    const expectedBuffer = Buffer.from(expectedSignature, "hex")

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null
    }

    const payload = JSON.parse(payloadString)
    if (!payload?.userId || !payload?.email) return null

    return payload
  } catch (error) {
    console.error("[v0] Session verification error:", error)
    return null
  }
}

async function findUserById(userId: number) {
  const users = await sql<User[]>`
    SELECT id, email, name, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `
  return users[0] ?? null
}

export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = verifySession(token)
  if (!payload) return null

  return findUserById(payload.userId)
}

export async function getUserFromCookies(): Promise<User | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = verifySession(token)
  if (!payload) return null

  return findUserById(payload.userId)
}

export function setSessionCookie(response: Response & { cookies: any }, payload: SessionPayload) {
  const token = signSession(payload)
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    maxAge: SESSION_MAX_AGE,
    ...baseCookieConfig,
  })
}

export function clearSessionCookie(response: Response & { cookies: any }) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...baseCookieConfig,
  })
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE }
