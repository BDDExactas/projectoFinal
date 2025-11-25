"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User } from "@/lib/db-types"
import { AlertCircle, LogIn } from "lucide-react"

interface LoginCardProps {
  onLogin?: (user: User) => void
}

export function LoginCard({ onLogin }: LoginCardProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "register">("login")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showSecretWarning, setShowSecretWarning] = useState(false)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/auth/config")
        if (!res.ok) return
        const data = await res.json()
        if (data.usesFallbackSessionSecret) {
          setShowSecretWarning(true)
        }
      } catch (err) {
        console.warn("[v0] Failed to load auth config", err)
      }
    }
    fetchConfig()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login"
      const payload =
        mode === "register"
          ? { email, name, password }
          : { email, password }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "No se pudo iniciar sesión")
        return
      }

      onLogin?.(data.user)
    } catch (err) {
      console.error("[v0] Login request error:", err)
      setError("No se pudo iniciar sesión. Intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-primary" />
          Ingresar
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                required={mode === "register"}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {showSecretWarning && (
            <div className="rounded-md border border-yellow-300/60 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              Usando SESSION_SECRET temporario. Agregar SESSION_SECRET a .env.local para no perder sesiones al reiniciar.
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? mode === "register"
                ? "Creando cuenta..."
                : "Ingresando..."
              : mode === "register"
                ? "Crear cuenta"
                : "Entrar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register")
              setError("")
            }}
          >
            {mode === "register" ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
