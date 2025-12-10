"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import type { Instrument } from "@/lib/db-types"
import { allowedTransactionTypes } from "@/lib/validation/transaction"
import { todayIsoDate } from "@/lib/dates"
import { format } from "date-fns"
import { formatMoney, formatNumber } from "@/lib/format"

type TransactionRow = {
  account_user_email: string
  account_name: string
  instrument_code: string
  transaction_date: string
  transaction_type: string
  quantity: number
  price?: number | null
  total_amount?: number | null
  currency_code: string
  description?: string | null
  created_at: string
}

export function TransactionsCrud({ userEmail }: { userEmail: string }) {
  const [accounts, setAccounts] = useState<Array<{ name: string }>>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    accountName: "",
    instrumentCode: "",
    date: todayIsoDate(),
    type: "buy",
    quantity: "",
    price: "",
    currency: "ARS",
    description: "",
  })

  const accountOptions = useMemo(() => accounts.map((a) => a.name), [accounts])

  useEffect(() => {
    async function fetchAux() {
      try {
        const [instRes, accRes] = await Promise.all([
          fetch(`/api/instruments`),
          fetch(`/api/accounts?userEmail=${encodeURIComponent(userEmail)}`),
        ])
        const instData = await instRes.json()
        setInstruments(instData.instruments || [])
        const accData = await accRes.json()
        setAccounts(accData.accounts || [])
        if (accData.accounts?.length) {
          setForm((prev) => ({ ...prev, accountName: prev.accountName || accData.accounts[0].name }))
        }
      } catch (error) {
        console.error("[v0] Failed to fetch aux data:", error)
      }
    }
    fetchAux()
    refreshTransactions()
  }, [userEmail])

  const refreshTransactions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?userEmail=${encodeURIComponent(userEmail)}&limit=50`)
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch (error) {
      console.error("[v0] Fetch transactions error:", error)
      toast({ title: "Error", description: "No se pudieron cargar las transacciones", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setForm({
      accountName: accountOptions[0] || "",
      instrumentCode: instruments[0]?.code || "",
      date: todayIsoDate(),
      type: "buy",
      quantity: "",
      price: "",
      currency: "ARS",
      description: "",
    })
  }

  const handleSubmit = async () => {
    if (!form.accountName || !form.instrumentCode || !form.quantity) {
      toast({ title: "Faltan datos", description: "Completa cuenta, instrumento y cantidad", variant: "destructive" })
      return
    }

    setSaving(true)
    const payload = {
      userEmail,
      accountName: form.accountName,
      instrumentCode: form.instrumentCode,
      type: form.type,
      quantity: Number(form.quantity),
      price: form.price ? Number(form.price) : undefined,
      date: form.date,
      currency: form.currency || "ARS",
      description: form.description || undefined,
    }

    try {
      const res = await fetch("/api/transactions", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { 
          ...payload, 
          createdAt: editing.created_at,
          originalAccountName: editing.account_name,
          originalInstrumentCode: editing.instrument_code,
        } : payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      toast({ title: editing ? "Transacción actualizada" : "Transacción creada" })
      await refreshTransactions()
      resetForm()
    } catch (error) {
      console.error("[v0] Save transaction error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la transacción",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (tx: TransactionRow) => {
    setEditing(tx)
    setForm({
      accountName: tx.account_name,
      instrumentCode: tx.instrument_code,
      date: tx.transaction_date.slice(0, 10),
      type: tx.transaction_type,
      quantity: String(tx.quantity),
      price: tx.price ? String(tx.price) : "",
      currency: tx.currency_code,
      description: tx.description || "",
    })
  }

  const handleDelete = async (tx: TransactionRow) => {
    if (!confirm("¿Eliminar esta transacción?")) return
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          accountName: tx.account_name,
          instrumentCode: tx.instrument_code,
          createdAt: tx.created_at,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      toast({ title: "Transacción eliminada" })
      if (editing?.created_at === tx.created_at) resetForm()
      await refreshTransactions()
    } catch (error) {
      console.error("[v0] Delete transaction error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la transacción",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Editar transacción" : "Nueva transacción"}</CardTitle>
          <CardDescription>Gestiona movimientos directamente desde el frontend (sin Excel).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <div className="space-y-1">
                <Input
                  list="account-options"
                  value={form.accountName}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountName: e.target.value }))}
                  disabled={!!editing}
                  placeholder="Selecciona o escribe una cuenta"
                />
                <datalist id="account-options">
                  {accountOptions.map((acc) => (
                    <option key={acc} value={acc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instrumento</Label>
              <Select
                value={form.instrumentCode}
                onValueChange={(val) => setForm((prev) => ({ ...prev, instrumentCode: val }))}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un instrumento" />
                </SelectTrigger>
                <SelectContent>
                  {instruments.map((inst) => (
                    <SelectItem key={inst.code} value={inst.code}>
                      {inst.code} - {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(val) => setForm((prev) => ({ ...prev, type: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransactionTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Precio (opcional)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Moneda</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                placeholder="ARS"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {editing && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Cancelar edición
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar transacción"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones recientes</CardTitle>
          <CardDescription>Filtradas por usuario, ordenadas por fecha.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="h-32 animate-pulse bg-muted/30 rounded" />
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay transacciones registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Instrumento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.created_at}>
                    <TableCell>{format(new Date(tx.transaction_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{tx.account_name}</TableCell>
                    <TableCell>{tx.instrument_code}</TableCell>
                    <TableCell className="capitalize">{tx.transaction_type}</TableCell>
                    <TableCell className="text-right">{formatNumber(tx.quantity)}</TableCell>
                    <TableCell className="text-right">
                      {tx.price ? formatMoney(tx.price, tx.currency_code) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {tx.total_amount ? formatMoney(tx.total_amount, tx.currency_code) : "-"}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(tx)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tx)}>
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
