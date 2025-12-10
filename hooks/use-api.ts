"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseApiOptions<T> {
  select?: (json: any) => T
  initialData?: T
  pollIntervalMs?: number
}

export function useApiQuery<T = any>(url: string, options: UseApiOptions<T> = {}) {
  const { select, initialData, pollIntervalMs } = options
  const initialDataRef = useRef(initialData)
  const [data, setData] = useState<T | undefined>(initialDataRef.current)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(url, { signal: controller.signal })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
        setData(select ? select(json) : (json as T))
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
        // Preserve last good data on errors to avoid blanking the UI
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [url, select],
  )

  useEffect(() => {
    fetchData()

    if (pollIntervalMs && pollIntervalMs > 0) {
      const id = setInterval(() => fetchData(true), pollIntervalMs)
      return () => clearInterval(id)
    }
  }, [fetchData, pollIntervalMs])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { data, loading, error, refresh: fetchData }
}
