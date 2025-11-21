import { NextResponse } from "next/server"
import { isUsingFallbackSessionSecret } from "@/lib/auth"

export async function GET() {
  return NextResponse.json({ usesFallbackSessionSecret: isUsingFallbackSessionSecret() })
}
