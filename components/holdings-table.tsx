"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { AccountValuation } from "@/lib/db-types"
import type { Instrument } from "@/lib/db-types"

export function HoldingsTable({ userId }: { userId: number }) {
  const [holdings, setHoldings] = useState<AccountValuation[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const VALUATIONS_POLL_MS = 120_000

  // Add-asset (global) state
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [portfolios, setPortfolios] = useState<Array<{ account_id: number; account_name: string }>>([])
  const [addOpen, setAddOpen] = useState(false)
  const [selInstrument, setSelInstrument] = useState("")
  const [selAccount, setSelAccount] = useState<string>("")
  const [addQty, setAddQty] = useState<string>("")
  const [addPrice, setAddPrice] = useState<string>("")
  const [adding, setAdding] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"add" | "remove">("add")
  const [activeHolding, setActiveHolding] = useState<AccountValuation | null>(null)
  const [adjQuantity, setAdjQuantity] = useState<string>("")
  const [adjPrice, setAdjPrice] = useState<string>("")

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/dashboard/valuations?userId=${userId}`)
        const data = await response.json()
        setHoldings(data.valuations || [])
      } catch (error) {
        console.error("[v0] Failed to fetch holdings:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // fetch instruments and portfolios for add-asset dialog
    ;(async function fetchAux() {
      try {
        const resp = await fetch(`/api/instruments`)
        const d = await resp.json()
        setInstruments(d.instruments || [])
      } catch (err) {
        console.error("[v0] Failed to fetch instruments:", err)
      }

      try {
        const resp2 = await fetch(`/api/dashboard/portfolio-totals?userId=${userId}`)
        const d2 = await resp2.json()
        setPortfolios(d2.portfolios || [])
        if (d2.portfolios?.length) setSelAccount(String(d2.portfolios[0].account_id))
      } catch (err) {
        console.error("[v0] Failed to fetch portfolios:", err)
      }
    })()

    const interval = setInterval(() => {
      refresh()
    }, VALUATIONS_POLL_MS)

    return () => clearInterval(interval)
  }, [userId])

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch(`/api/dashboard/valuations?userId=${userId}`)
      const data = await response.json()
      setHoldings(data.valuations || [])
    } catch (error) {
      console.error("[v0] Failed to fetch holdings:", error)
    } finally {
      setLoading(false)
    }
  }

  async function submitAdjustment() {
    if (!activeHolding) return
    const qty = Number(adjQuantity)
    if (!qty || qty <= 0) {
      toast({ title: "Cantidad inválida", description: "Ingrese una cantidad mayor que 0", variant: "destructive" })
      return
    }

    const payload = {
      userId,
      accountId: activeHolding.account_id,
      instrumentCode: activeHolding.instrument_code,
      type: dialogAction === "add" ? "buy" : "sell",
      quantity: qty,
      price: adjPrice ? Number(adjPrice) : undefined,
      date: new Date().toISOString().slice(0, 10),
      description: dialogAction === "add" ? "Ajuste: agregar" : "Ajuste: quitar",
      currency: activeHolding.currency_code,
    }

    try {
      const res = await fetch(`/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      setDialogOpen(false)
      setAdjPrice("")
      setAdjQuantity("")
      setActiveHolding(null)
      toast({ title: "Ajuste aplicado", description: "La transacción fue registrada" })
      await refresh()
    } catch (error) {
      console.error("[v0] Adjustment error:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Error al aplicar ajuste", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tenencias por Instrumento</CardTitle>
          <div className="flex gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  Agregar Activo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Activo</DialogTitle>
                  <DialogDescription>Selecciona cuenta, instrumento e ingresa la cantidad comprada</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="account">Cuenta</Label>
                    <Select id="account" value={selAccount} onValueChange={setSelAccount}>
                      <SelectTrigger id="account">
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {portfolios.map((p) => (
                          <SelectItem key={p.account_id} value={String(p.account_id)}>
                            {p.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="instrument">Instrumento</Label>
                    <Select id="instrument" value={selInstrument} onValueChange={setSelInstrument}>
                      <SelectTrigger id="instrument">
                        <SelectValue placeholder="Selecciona un instrumento" />
                      </SelectTrigger>
                      <SelectContent>
                        {instruments.map((inst) => (
                          <SelectItem key={inst.id} value={String(inst.id)}>
                            {inst.code} - {inst.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="qty">Cantidad</Label>
                    <Input id="qty" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="price">Precio (opcional)</Label>
                    <Input id="price" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={async () => {
                        const qty = Number(addQty)
                        if (!selAccount || !selInstrument || !qty || qty <= 0) {
                          toast({ title: "Datos inválidos", description: "Seleccioná cuenta, instrumento y cantidad válida", variant: "destructive" })
                          return
                        }
                        const inst = instruments.find((i) => String(i.id) === selInstrument)
                        if (!inst) {
                          toast({ title: "Instrumento inválido", variant: "destructive" })
                          return
                        }
                        setAdding(true)
                        try {
                          const res = await fetch(`/api/transactions`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              userId,
                              accountId: Number(selAccount),
                              instrumentCode: inst.code,
                              type: "buy",
                              quantity: qty,
                              price: addPrice ? Number(addPrice) : undefined,
                              date: new Date().toISOString().slice(0, 10),
                              description: "Compra: agregar desde Tenencias",
                              currency: inst.currency_code ?? "ARS",
                            }),
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error || "Error")
                          setAddOpen(false)
                          setSelInstrument("")
                          setAddQty("")
                          setAddPrice("")
                          toast({ title: "Activo agregado", description: "La tenencia fue creada/actualizada" })
                          await refresh()
                        } catch (err) {
                          console.error("[v0] Add asset error:", err)
                          toast({ title: "Error", description: err instanceof Error ? err.message : "Error al agregar activo", variant: "destructive" })
                        } finally {
                          setAdding(false)
                        }
                      }}
                      disabled={adding}
                    >
                      {adding ? "Agregando..." : "Agregar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instrumento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio promedio</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Valorización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay tenencias registradas
                </TableCell>
              </TableRow>
            ) : (
              holdings.map((holding, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{holding.instrument_code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{holding.instrument_type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{holding.account_name}</TableCell>
                  <TableCell className="text-right">{Number(holding.quantity).toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right">
                    {holding.average_price != null ? (
                      <>${Number(holding.average_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    ${Number(holding.current_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    ${Number(holding.valuation).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setDialogAction("add")
                          setActiveHolding(holding)
                          setAdjQuantity("")
                          setAdjPrice("")
                          setDialogOpen(true)
                        }}
                      >
                        Agregar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDialogAction("remove")
                          setActiveHolding(holding)
                          setAdjQuantity("")
                          setAdjPrice("")
                          setDialogOpen(true)
                        }}
                      >
                        Quitar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Shared dialog for add/remove adjustments */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              {
                // Compute title/description once to avoid inconsistent rendering
              }
              {(() => {
                const code = activeHolding ? activeHolding.instrument_code : ""
                const acc = activeHolding ? activeHolding.account_name : ""
                const dialogTitleText = dialogAction === "add" ? `Agregar ${code} - ${acc}` : `Quitar ${code} - ${acc}`
                const dialogDescText = dialogAction === "add" ? "Ingrese cantidad y precio (opcional)" : "Ingrese cantidad a quitar y precio (opcional)"
                return (
                  <>
                    <DialogTitle>{dialogTitleText}</DialogTitle>
                    <DialogDescription>{dialogDescText}</DialogDescription>
                  </>
                )
              })()}
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="qty">Cantidad</Label>
                <Input id="qty" value={adjQuantity} onChange={(e) => setAdjQuantity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="price">Precio (opcional)</Label>
                <Input id="price" value={adjPrice} onChange={(e) => setAdjPrice(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submitAdjustment}>{dialogAction === "add" ? "Agregar" : "Quitar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
