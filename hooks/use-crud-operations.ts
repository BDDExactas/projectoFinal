import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client"
import { z } from "zod"

interface UseCrudOperationsOptions {
  entityName: string
  apiEndpoint: string
  onSuccess?: () => void | Promise<void>
  validateSchema?: z.ZodSchema
}

export function useCrudOperations<T extends Record<string, any>>(
  options: UseCrudOperationsOptions
) {
  const { entityName, apiEndpoint, onSuccess, validateSchema } = options
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const create = async (data: T) => {
    if (validateSchema) {
      const result = validateSchema.safeParse(data)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        const firstError = Object.values(errors)[0]?.[0]
        toast({
          title: "Validación",
          description: firstError || "Datos inválidos",
          variant: "destructive",
        })
        return null
      }
    }

    try {
      setLoading(true)
      const response = await apiPost(apiEndpoint, data)
      toast({
        title: "Éxito",
        description: `${entityName} creado correctamente`,
      })
      if (onSuccess) await onSuccess()
      return response
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : `Error al crear ${entityName}`
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const update = async (data: T) => {
    if (validateSchema) {
      const result = validateSchema.safeParse(data)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        const firstError = Object.values(errors)[0]?.[0]
        toast({
          title: "Validación",
          description: firstError || "Datos inválidos",
          variant: "destructive",
        })
        return null
      }
    }

    try {
      setLoading(true)
      const response = await apiPut(apiEndpoint, data)
      toast({
        title: "Éxito",
        description: `${entityName} actualizado correctamente`,
      })
      if (onSuccess) await onSuccess()
      return response
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : `Error al actualizar ${entityName}`
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const remove = async (identifier: any) => {
    try {
      setLoading(true)
      const response = await apiDelete(apiEndpoint, identifier)
      toast({
        title: "Éxito",
        description: `${entityName} eliminado correctamente`,
      })
      if (onSuccess) await onSuccess()
      return response
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : `Error al eliminar ${entityName}`
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  return { create, update, remove, loading }
}
