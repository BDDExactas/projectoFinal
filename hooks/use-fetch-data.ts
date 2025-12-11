import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiGet, ApiError } from "@/lib/api-client"

interface UseFetchDataOptions {
  errorTitle?: string
  errorDescription?: string
  autoFetch?: boolean
}

export function useFetchData<T>(
  url: string,
  options: UseFetchDataOptions = {}
) {
  const {
    errorTitle = "Error",
    errorDescription = "No se pudieron cargar los datos",
    autoFetch = true,
  } = options

  const { toast } = useToast()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiGet<T>(url)
      setData(result)
      return result
    } catch (err) {
      const errorMsg = err instanceof ApiError ? err.message : errorDescription
      setError(errorMsg)
      toast({
        title: errorTitle,
        description: errorMsg,
        variant: "destructive",
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [url, errorTitle, errorDescription, toast])

  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }
  }, [autoFetch, fetchData])

  return { data, loading, error, refetch: fetchData }
}
