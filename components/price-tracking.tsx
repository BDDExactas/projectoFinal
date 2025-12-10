"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
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
import { useApiQuery } from "@/hooks/use-api"
import { formatMoney } from "@/lib/format"
import { todayIsoDate, toIsoDateString } from "@/lib/dates"

interface PriceWithInstrument extends InstrumentPrice {
  instrument_code: string
  instrument_name: string
  instrument_type: string
  as_of?: string
}

const PRICE_POLL_MS = 120_000
type PriceKey = { instrument_code: string; price_date: string }

export function PriceTracking() {
  const selectPrices = useCallback((json: any) => json.prices || [], [])
  const {
    data: prices = [],
    loading: pricesLoading,
    error: pricesError,
    refresh: refreshPrices,
  } = useApiQuery<PriceWithInstrument[]>("/api/prices", {
    select: selectPrices,
    initialData: [],
    pollIntervalMs: PRICE_POLL_MS,
  })

  const selectInstruments = useCallback((json: any) => json.instruments || [], [])
  const { data: instruments = [] } = useApiQuery<Instrument[]>("/api/instruments", {
    select: selectInstruments,
    initialData: [],
  })
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: string[] } | null>(null)
 
  // Inline edit state
  const [editingKey, setEditingKey] = useState<PriceKey | null>(null)
  const [editPrice, setEditPrice] = useState("")
  const [editDate, setEditDate] = useState("")

  // Form state
  const [selectedInstrument, setSelectedInstrument] = useState("")
  const [priceValue, setPriceValue] = useState("")
  const [priceDate, setPriceDate] = useState(todayIsoDate())
  const [currencyCode, setCurrencyCode] = useState("ARS")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!pricesError && !pricesLoading) {
      setLastUpdated(new Date().toLocaleTimeString("es-AR"))
    }
  }, [pricesLoading, pricesError, prices])

  useEffect(() => {
    if (pricesError) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los precios",
        variant: "destructive",
      })
    }
  }, [pricesError, toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const priceNumber = Number(priceValue.replace(',', '.'))
    if (!selectedInstrument) {
      toast({ title: "Instrumento requerido", description: "Selecciona un instrumento", variant: "destructive" })
      setSubmitting(false)
      return
    }
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      toast({ title: "Precio inválido", description: "Ingresa un precio numérico mayor que 0", variant: "destructive" })
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_code: selectedInstrument,
          price: priceNumber,
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
        await refreshPrices(true)
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
    setPriceDate(todayIsoDate())
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
      await refreshPrices(true)
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
    // Find the next older price for the same instrument in the already-recency-sorted list
    for (let j = index + 1; j < prices.length; j++) {
      if (prices[j].instrument_code === prices[index].instrument_code) {
        const previous = prices[j]
        if (!previous.price || Number(previous.price) === 0) return null
        const change = ((currentPrice - Number(previous.price)) / Number(previous.price)) * 100
        return { change, isPositive: change >= 0 }
      }
    }
    return null
  }

  async function handleUpdatePrice(key: PriceKey) {
    const priceNum = Number(editPrice.replace(',', '.'))
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast({ title: "Precio inválido", description: "Ingresa un precio numérico mayor que 0", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_code: key.instrument_code,
          price_date: editDate || key.price_date,
          price: priceNum,
          currency_code:
            prices.find(
              (p) => p.instrument_code === key.instrument_code && toIsoDateString(p.price_date) === key.price_date,
            )?.currency_code ?? "ARS",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al actualizar")
      }

      setEditingKey(null)
      await refreshPrices(true)
      toast({ title: "Exito", description: "Precio actualizado" })
    } catch (error) {
      console.error("[v0] Update price error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar",
        variant: "destructive",
      })
    }
  }

  async function handleDeletePrice(key: PriceKey) {
    if (!confirm("Estás seguro de que quieres eliminar este precio?")) return

    try {
      const res = await fetch("/api/prices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument_code: key.instrument_code, price_date: key.price_date }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al eliminar")
      }

      await refreshPrices(true)
      toast({ title: "Exito", description: "Precio eliminado" })
    } catch (error) {
      console.error("[v0] Delete price error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar",
        variant: "destructive",
      })
    }
  }

  if (pricesLoading) {
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
              <p className="text-xs text-muted-foreground mt-1">Última actualización contra base de datos: {lastUpdated}</p>
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
                          <SelectItem key={instrument.code} value={instrument.code}>
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
                : `Actualización parcial: ${syncResult.updated} precios actualizados, ${syncResult.errors.length} no disponibles.`}
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
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay precios registrados
                </TableCell>
              </TableRow>
            ) : (
              prices.map((price, index) => {
                const priceChange = getPriceChange(Number(price.price), index)
                const rowKey: PriceKey = {
                  instrument_code: price.instrument_code,
                  price_date: toIsoDateString(price.price_date),
                }
                const isEditing =
                  editingKey?.instrument_code === rowKey.instrument_code &&
                  editingKey?.price_date === rowKey.price_date
                return (
                  <TableRow key={`${rowKey.instrument_code}-${rowKey.price_date}`}>
                    <TableCell className="font-medium">{price.instrument_code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{price.instrument_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="h-8 w-32"
                        />
                      ) : (
                        new Date(price.price_date).toLocaleDateString("es-AR")
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-8 w-24 text-right"
                          placeholder="0.00"
                        />
                      ) : (
                        `${price.currency_code} ${formatMoney(price.price, price.currency_code)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isEditing ? (
                        priceChange ? (
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
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdatePrice(rowKey)}
                            className="h-7 px-2 text-xs"
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingKey(null)
                              setEditPrice("")
                              setEditDate("")
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingKey(rowKey)
                              setEditPrice(Number(price.price).toString())
                              setEditDate(toIsoDateString(price.price_date))
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePrice(rowKey)}
                            className="h-7 px-2 text-xs"
                          >
                            Borrar
                          </Button>
                        </div>
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
