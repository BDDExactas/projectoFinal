"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UploadResult {
  success: boolean
  processed?: number
  errors?: number
  errorDetails?: string[]
}

export function FileUpload({ userId }: { userId: number }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      // Step 1: Upload file
      const formData = new FormData()
      formData.append("file", file)
      formData.append("userId", userId.toString())

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Upload failed")
      }

      const uploadData = await uploadResponse.json()

      // Step 2: Process transactions
      const processResponse = await fetch("/api/process-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploadData.file.id,
          buffer: uploadData.buffer,
          userId,
        }),
      })

      if (!processResponse.ok) {
        throw new Error("Processing failed")
      }

      const processData = await processResponse.json()
      setResult(processData)
      setFile(null)
    } catch (error) {
      console.error("[v0] Upload error:", error)
      setResult({
        success: false,
        errors: 1,
        errorDetails: ["Failed to upload and process file"],
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Cargar Transacciones
        </CardTitle>
        <CardDescription>Sube un archivo Excel con tus transacciones mensuales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50 transition-colors"
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{file ? file.name : "Click para seleccionar archivo Excel"}</p>
          </label>
        </div>

        {file && (
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Subir y Procesar
              </>
            )}
          </Button>
        )}

        {result && (
          <Alert variant={result.success && result.errors === 0 ? "default" : "destructive"}>
            {result.success && result.errors === 0 ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {result.success && result.errors === 0 ? (
                <div>
                  <p className="font-medium">Archivo procesado exitosamente</p>
                  <p className="text-sm">{result.processed} transacciones importadas</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">Procesamiento completado con errores</p>
                  <p className="text-sm">
                    {result.processed} procesadas, {result.errors} errores
                  </p>
                  {result.errorDetails && result.errorDetails.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer">Ver detalles</summary>
                      <ul className="mt-1 list-disc list-inside">
                        {result.errorDetails.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Formato esperado del Excel:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>fecha: Fecha de la transacción (YYYY-MM-DD)</li>
            <li>cuenta: Nombre de la cuenta</li>
            <li>instrumento: Código del instrumento (USD, ARS, AL30, etc.)</li>
            <li>tipo: Tipo de transacción (buy, sell, deposit, withdrawal)</li>
            <li>cantidad: Cantidad de unidades</li>
            <li>precio: Precio unitario (opcional)</li>
            <li>total: Monto total (opcional)</li>
            <li>moneda: Código de moneda (ARS, USD, etc.)</li>
            <li>descripcion: Descripción adicional (opcional)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
