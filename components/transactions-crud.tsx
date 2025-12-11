"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useFetchData } from "@/hooks/use-fetch-data"
import { apiDelete, ApiError } from "@/lib/api-client"
import type { Instrument } from "@/lib/db-types"
import { allowedTransactionTypes } from "@/lib/validation/transaction"
import { todayIsoDate } from "@/lib/dates"
import { format } from "date-fns"
import { formatMoney, formatNumber } from "@/lib/format"
import { z } from "zod"
import { Loader2, Trash2 } from "lucide-react"

const transactionSchema = z.object({
  userEmail: z.string(),
  accountName: z.string().min(1, "Selecciona una cuenta"),
  instrumentCode: z.string().min(1, "Selecciona un instrumento"),
  type: z.enum(["buy", "sell", "deposit", "withdrawal"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  quantity: z.number().positive("Cantidad debe ser positiva"),
  price: z.number().optional(),
  date: z.string(),
  currency: z.string().min(1, "Selecciona moneda"),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  originalAccountName: z.string().optional(),
  originalInstrumentCode: z.string().optional(),
})

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

interface AccountsResponse {
  accounts: Array<{ name: string }>
}

interface InstrumentsResponse {
  instruments: Instrument[]
}

interface TransactionsResponse {
  transactions: TransactionRow[]
}

export function TransactionsCrud({ userEmail }: { userEmail: string }) {
  const { toast } = useToast()

  const { data: accountsData, loading: accountsLoading } = useFetchData<AccountsResponse>(
    `/api/accounts?userEmail=${encodeURIComponent(userEmail)}`,
    { errorTitle: "Error", errorDescription: "No se pudieron cargar las cuentas" }
  )

  const { data: instrumentsData, loading: instrumentsLoading } = useFetchData<InstrumentsResponse>(
    `/api/instruments`,
    { errorTitle: "Error", errorDescription: "No se pudieron cargar los instrumentos" }
  )

  const { data: transactionsData, loading: transactionsLoading, refetch: refetchTransactions } = useFetchData<TransactionsResponse>(
    `/api/transactions?userEmail=${encodeURIComponent(userEmail)}&limit=50&_t=${Date.now()}`,
    { errorTitle: "Error", errorDescription: "No se pudieron cargar las transacciones" }
  )

  const accounts = accountsData?.accounts || []
  const instruments = instrumentsData?.instruments || []
  const transactions = transactionsData?.transactions || []

  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

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
    if (accountOptions.length > 0 && !form.accountName) {
      setForm((prev) => ({ ...prev, accountName: accountOptions[0] }))
    }
  }, [accountOptions, form.accountName])

  useEffect(() => {
    if (instruments.length > 0 && !form.instrumentCode) {
      setForm((prev) => ({ ...prev, instrumentCode: instruments[0].code }))
    }
  }, [instruments, form.instrumentCode])

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
    const result = transactionSchema.safeParse({
      userEmail,
      accountName: form.accountName,
      instrumentCode: form.instrumentCode,
      type: form.type,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      price: form.price ? Number(form.price) : undefined,
      date: form.date,
      currency: form.currency,
      description: form.description,
      ...(editing && {
        createdAt: editing.created_at,
        originalAccountName: editing.account_name,
        originalInstrumentCode: editing.instrument_code,
      }),
    })

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      const firstError = Object.values(errors)[0]?.[0]
      toast({ title: "Validación", description: firstError || "Datos inválidos", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/transactions", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      })
      const data = await res.json()
      if (!res.ok) throw new ApiError(data.error || "Error", res.status)
      
      toast({ title: editing ? "Transacción actualizada" : "Transacción creada" })
      await refetchTransactions()
      resetForm()
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : "No se pudo guardar la transacción"
      toast({ title: "Error", description: errorMsg, variant: "destructive" })
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setSaving(true)
      await apiDelete("/api/transactions", {
        userEmail,
        accountName: deleteTarget.account_name,
        instrumentCode: deleteTarget.instrument_code,
        createdAt: deleteTarget.created_at,
      })
      
      toast({ title: "Transacción eliminada" })
      if (editing?.created_at === deleteTarget.created_at) resetForm()
      await refetchTransactions()
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : "No se pudo eliminar la transacción"
      toast({ title: "Error", description: errorMsg, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const isLoading = accountsLoading || instrumentsLoading || transactionsLoading

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
              <Select
                value={form.accountName}
                onValueChange={(val) => setForm((prev) => ({ ...prev, accountName: val }))}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.name} value={acc.name}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button variant="outline" onClick={resetForm} disabled={saving || isLoading}>
                Cancelar edición
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={saving || isLoading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : editing ? (
                "Guardar cambios"
              ) : (
                "Agregar transacción"
              )}
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
          {isLoading ? (
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
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(tx)} disabled={saving}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget(tx)
                          setIsDeleteDialogOpen(true)
                        }}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>¿Eliminar transacción?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
