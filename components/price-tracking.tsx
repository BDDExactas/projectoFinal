"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { InstrumentPrice, Instrument } from "@/lib/db-types"

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
  as_of?: string
}

const PRICE_POLL_MS = 120_000

export function PriceTracking() {
  const [prices, setPrices] = useState<PriceWithInstrument[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: string[] } | null>(null)
 

  // Form state
  const [selectedInstrument, setSelectedInstrument] = useState("")
  const [priceValue, setPriceValue] = useState("")
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split("T")[0])
  const [currencyCode, setCurrencyCode] = useState("ARS")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchPrices()
    fetchInstruments()

    const interval = setInterval(() => {
      fetchPrices(true)
    }, PRICE_POLL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])

  async function fetchPrices(silent = false) {
    try {
      if (!silent) setLoading(true)
      const response = await fetch("/api/prices")
      const data = await response.json()
      setPrices(data.prices || [])
      setLastUpdated(new Date().toLocaleTimeString("es-AR"))
    } catch (error) {
      console.error("[v0] Failed to fetch prices:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los precios",
        variant: "destructive",
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function fetchInstruments() {
    try {
      const response = await fetch("/api/instruments")
      const data = await response.json()
      setInstruments(data.instruments || [])
    } catch (error) {
      console.error("[v0] Failed to fetch instruments:", error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_id: Number.parseInt(selectedInstrument),
          price: Number.parseFloat(priceValue),
          price_date: priceDate,
          currency_code: currencyCode,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Precio actualizado",
          description: "El precio se ha guardado correctamente",
        })
        setDialogOpen(false)
        resetForm()
        fetchPrices()
      } else {
        throw new Error(data.error || "Error al guardar el precio")
      }
    } catch (error) {
      console.error("[v0] Failed to save price:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el precio",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSelectedInstrument("")
    setPriceValue("")
    setPriceDate(new Date().toISOString().split("T")[0])
    setCurrencyCode("ARS")
  }

  async function handleSync() {
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/prices/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudieron actualizar los precios")
      setSyncResult({ updated: data.updated ?? 0, errors: data.errors ?? [] })
      await fetchPrices(true)
    } catch (error) {
      console.error("[v0] Sync error:", error)
      toast({
        title: "Error al sincronizar",
        description: error instanceof Error ? error.message : "No se pudo actualizar",
        variant: "destructive",
      })
    } finally {
      setSyncLoading(false)
    }
  }

  function getPriceChange(currentPrice: number, index: number): { change: number; isPositive: boolean } | null {
    if (index >= prices.length - 1) return null
    const previousPrice = prices[index + 1]
    if (previousPrice.instrument_code !== prices[index].instrument_code) return null

    const change = ((currentPrice - Number(previousPrice.price)) / Number(previousPrice.price)) * 100
    return { change, isPositive: change >= 0 }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seguimiento de Precios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Seguimiento de Precios</CardTitle>
            <CardDescription>Gestiona los precios históricos de tus instrumentos</CardDescription>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">Última actualización: {lastUpdated}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncLoading}>
              {syncLoading ? "Actualizando..." : "Actualizar Precios"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Precio
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Precio de Instrumento</DialogTitle>
                  <DialogDescription>Ingresa el precio actual o histórico de un instrumento</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="instrument">Instrumento</Label>
                    <Select value={selectedInstrument} onValueChange={setSelectedInstrument} required>
                      <SelectTrigger id="instrument">
                        <SelectValue placeholder="Selecciona un instrumento" />
                      </SelectTrigger>
                      <SelectContent>
                        {instruments.map((instrument) => (
                          <SelectItem key={instrument.id} value={instrument.id.toString()}>
                            {instrument.code} - {instrument.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={priceValue}
                        onChange={(e) => setPriceValue(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Moneda</Label>
                      <Select value={currencyCode} onValueChange={setCurrencyCode}>
                        <SelectTrigger id="currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">ARS</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={priceDate}
                      onChange={(e) => setPriceDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Guardando..." : "Guardar Precio"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {syncResult && (
          <Alert
            className={`mb-4 ${
              syncResult.errors.length > 0 ? "border-amber-500/50 bg-amber-500/10" : "border-green-500/50 bg-green-500/10"
            }`}
          >
            <AlertDescription
              className={syncResult.errors.length > 0 ? "text-amber-800" : "text-green-700"}
            >
              {syncResult.errors.length === 0
                ? `Actualización completada: ${syncResult.updated} precios actualizados.`
                : `Actualización parcial: ${syncResult.updated} precios actualizados, ${syncResult.errors.length} errores.`}
              {syncResult.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {syncResult.errors.slice(0, 3).map((err, idx) => (
                    <li key={idx} className="text-amber-800">
                      {err.toString()}
                    </li>
                  ))}
                  {syncResult.errors.length > 3 && (
                    <li className="text-amber-800">…y {syncResult.errors.length - 3} más</li>
                  )}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instrumento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay precios registrados
                </TableCell>
              </TableRow>
            ) : (
              prices.map((price, index) => {
                const priceChange = getPriceChange(Number(price.price), index)
                return (
                  <TableRow key={`${price.id}-${price.price_date}`}>
                    <TableCell className="font-medium">{price.instrument_code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{price.instrument_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(price.price_date).toLocaleDateString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {price.currency_code} ${Number(price.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {priceChange ? (
                        <div
                          className={`flex items-center justify-end gap-1 ${priceChange.isPositive ? "text-green-600" : "text-red-600"}`}
                        >
                          {priceChange.isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-medium">{Math.abs(priceChange.change).toFixed(2)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
