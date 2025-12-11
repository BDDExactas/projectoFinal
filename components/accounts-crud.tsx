"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react"
import { z } from "zod"
import { useFetchData } from "@/hooks/use-fetch-data"
import { apiDelete, ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

const accountSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").trim(),
  account_type: z.string().min(1, "El tipo de cuenta es requerido").trim(),
  bank_name: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
  parent_account_name: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
})

interface Account {
  user_email: string
  name: string
  account_type: string
  bank_name?: string
  parent_account_name?: string
  created_at: string
  updated_at: string
}

interface ApiResponse {
  accounts: Account[]
}

export function AccountsCrud() {
  const { toast } = useToast()
  const { data, loading, refetch } = useFetchData<ApiResponse>(
    "/api/accounts",
    {
      errorTitle: "Error",
      errorDescription: "No se pudieron cargar las cuentas",
    }
  )

  const accounts = data?.accounts || []

  const [operationLoading, setOperationLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    account_type: "",
    bank_name: "",
    parent_account_name: "",
  })

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        name: account.name,
        account_type: account.account_type,
        bank_name: account.bank_name || "",
        parent_account_name: account.parent_account_name || "",
      })
    } else {
      setEditingAccount(null)
      setFormData({ name: "", account_type: "", bank_name: "", parent_account_name: "" })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const result = accountSchema.safeParse(formData)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      const firstError = Object.values(errors)[0]?.[0]
      toast({
        title: "Validación",
        description: firstError || "Datos inválidos",
        variant: "destructive",
      })
      return
    }

    try {
      setOperationLoading(true)
      const cleanedData = result.data

      // Si estamos editando y el nombre cambió, necesitamos DELETE + INSERT
      if (editingAccount && editingAccount.name !== cleanedData.name) {
        await apiDelete(`/api/accounts?name=${encodeURIComponent(editingAccount.name)}`)
        await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        }).then(async (res) => {
          if (!res.ok) {
            const error = await res.json()
            throw new ApiError(error.error || "Error al renombrar cuenta", res.status)
          }
        })
      } else {
        const method = editingAccount ? "PUT" : "POST"
        await fetch("/api/accounts", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        }).then(async (res) => {
          if (!res.ok) {
            const error = await res.json()
            throw new ApiError(error.error || "Error al guardar", res.status)
          }
        })
      }

      toast({
        title: "Éxito",
        description: `Cuenta ${editingAccount ? "actualizada" : "creada"} correctamente`,
      })

      setIsDialogOpen(false)
      setEditingAccount(null)
      setFormData({ name: "", account_type: "", bank_name: "", parent_account_name: "" })
      await refetch()
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : "Error al guardar cuenta"
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setOperationLoading(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      setOperationLoading(true)
      await apiDelete(`/api/accounts?name=${encodeURIComponent(name)}`)
      toast({
        title: "Éxito",
        description: "Cuenta eliminada correctamente",
      })
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      await refetch()
    } catch (error) {
      const errorMsg = error instanceof ApiError ? error.message : "Error al eliminar cuenta"
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setOperationLoading(false)
    }
  }

  const isLoading = loading || operationLoading

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Cuentas</CardTitle>
            <CardDescription>Crear, editar y eliminar cuentas o carteras</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Cuenta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Editar Cuenta" : "Crear Cuenta"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Banco Galicia"
                  />
                  {editingAccount && (
                    <p className="text-xs text-muted-foreground">
                      Cambiar el nombre creará una nueva cuenta y eliminará la anterior
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Cuenta *</Label>
                  <Input
                    id="account_type"
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    placeholder="Ej: Ahorros, Inversión, Trading"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Ej: Banco Galicia"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent_account_name">Cuenta Padre (opcional)</Label>
                  <Input
                    id="parent_account_name"
                    value={formData.parent_account_name}
                    onChange={(e) => setFormData({ ...formData, parent_account_name: e.target.value })}
                    placeholder="Para carteras anidadas"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {operationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingAccount ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading && accounts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No hay cuentas registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Cuenta Padre</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.name}>
                    <TableCell className="font-semibold">{account.name}</TableCell>
                    <TableCell>{account.account_type}</TableCell>
                    <TableCell className="text-muted-foreground">{account.bank_name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{account.parent_account_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(account)}
                          disabled={isLoading}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(account.name)
                            setIsDeleteDialogOpen(true)
                          }}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar Cuenta</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que deseas eliminar esta cuenta? Esta acción eliminará todas las transacciones y tenencias asociadas.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {operationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
