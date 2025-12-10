"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react"

interface Account {
  user_email: string
  name: string
  account_type: string
  bank_name?: string
  parent_account_name?: string
  created_at: string
  updated_at: string
}

export function AccountsCrud() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
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

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/accounts")
      if (!response.ok) throw new Error("Error al cargar cuentas")
      const data = await response.json()
      setAccounts(data.accounts || [])
    } catch (error) {
      console.error("Fetch error:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

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
      setFormData({
        name: "",
        account_type: "",
        bank_name: "",
        parent_account_name: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.account_type) {
      toast({
        title: "Validación",
        description: "Nombre y Tipo de cuenta son requeridos",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      // Limpiar campos vacíos para evitar FK violations
      const cleanedData = {
        name: formData.name.trim(),
        account_type: formData.account_type.trim(),
        bank_name: formData.bank_name.trim() || undefined,
        parent_account_name: formData.parent_account_name.trim() || undefined,
      }

      // Si estamos editando y el nombre cambió, necesitamos DELETE + INSERT
      if (editingAccount && editingAccount.name !== cleanedData.name) {
        // Primero eliminar la cuenta anterior
        await fetch(`/api/accounts?name=${encodeURIComponent(editingAccount.name)}`, {
          method: "DELETE",
        })
        
        // Luego crear la nueva
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Error al renombrar cuenta")
        }
      } else {
        // Crear nueva o actualizar existente
        const method = editingAccount ? "PUT" : "POST"
        const response = await fetch("/api/accounts", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Error al guardar")
        }
      }

      toast({
        title: "Éxito",
        description: `Cuenta ${editingAccount ? "actualizada" : "creada"} correctamente`,
      })

      setIsDialogOpen(false)
      setEditingAccount(null)
      await fetchAccounts()
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar cuenta",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/accounts?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al eliminar")
      }

      toast({
        title: "Éxito",
        description: "Cuenta eliminada correctamente",
      })

      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      await fetchAccounts()
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar cuenta",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

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
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                          disabled={loading}
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
                          disabled={loading}
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
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
