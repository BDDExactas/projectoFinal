"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export function HoldingsTable({ userId }: { userId: number }) {
  const [holdings, setHoldings] = useState<AccountValuation[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const VALUATIONS_POLL_MS = 120_000

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
        <CardTitle>Tenencias por Instrumento</CardTitle>
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
