"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Database } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function DatabaseInitializer() {
  // Only show this component when the public env var is explicitly enabled.
  // This prevents accidental DB resets in production or by regular users.
  const showInitializer = process.env.NEXT_PUBLIC_SHOW_DB_INIT === "true"
  if (!showInitializer) return null

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const initializeDatabase = async () => {
    setStatus("loading")
    setMessage("Inicializando base de datos...")

    try {
      const response = await fetch("/api/init-db", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        setStatus("success")
        setMessage("Base de datos inicializada correctamente. Recarga la página para ver los datos.")
      } else {
        setStatus("error")
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setStatus("error")
      setMessage(`Error al inicializar: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  return (
    <Card className="border-yellow-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Inicialización de Base de Datos
        </CardTitle>
        <CardDescription>
          La base de datos está vacía. Haz clic en el botón para crear las tablas y datos iniciales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={initializeDatabase} disabled={status === "loading" || status === "success"} className="w-full">
          {status === "loading" ? "Inicializando..." : "Inicializar Base de Datos"}
        </Button>

        {status === "success" && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">{message}</AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-500">{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
