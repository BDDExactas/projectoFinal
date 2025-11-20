"use client"

import { useCallback, useEffect, useState } from "react"
import type { User } from "@/lib/db-types"

interface UseCurrentUserResult {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  setUser: React.Dispatch<React.SetStateAction<User | null>>
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/me")
      if (!response.ok) {
        setUser(null)
        return
      }
      const data = await response.json()
      setUser(data.user ?? null)
    } catch (error) {
      console.error("[v0] Current user fetch error:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
    } catch (error) {
      console.error("[v0] Logout error:", error)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { user, loading, refresh, logout, setUser }
}
