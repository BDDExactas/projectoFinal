import { z } from "zod"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const apiResponseSchema = z.object({
  error: z.string().optional(),
})

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options)
    const data = await response.json()

    if (!response.ok) {
      const parsed = apiResponseSchema.safeParse(data)
      const errorMessage = parsed.success && parsed.data.error 
        ? parsed.data.error 
        : "Error en la solicitud"
      throw new ApiError(errorMessage, response.status, data)
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Error de red",
      0
    )
  }
}

export async function apiGet<T = any>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: "GET" })
}

export async function apiPost<T = any>(
  url: string,
  body: any
): Promise<T> {
  return apiRequest<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function apiPut<T = any>(
  url: string,
  body: any
): Promise<T> {
  return apiRequest<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function apiDelete<T = any>(
  url: string,
  body?: any
): Promise<T> {
  const options: RequestInit = {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  return apiRequest<T>(url, options)
}
