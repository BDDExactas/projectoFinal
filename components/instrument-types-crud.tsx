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
import { useCrudOperations } from "@/hooks/use-crud-operations"

const instrumentTypeSchema = z.object({
  code: z.string().min(1, "El código es requerido").transform(s => s.toLowerCase().trim()),
  name: z.string().min(1, "El nombre es requerido").trim(),
})

interface InstrumentType {
  code: string
  name: string
}

interface ApiResponse {
  types: InstrumentType[]
}

export function InstrumentTypesCrud() {
  const { data, loading, refetch } = useFetchData<ApiResponse>(
    "/api/instrument-types",
    {
      errorTitle: "Error",
      errorDescription: "No se pudieron cargar los tipos de instrumento",
    }
  )

  const types = data?.types || []

  const { create, update, remove, loading: operationLoading } = useCrudOperations<z.infer<typeof instrumentTypeSchema>>({
    entityName: "Tipo de instrumento",
    apiEndpoint: "/api/instrument-types",
    onSuccess: async () => { await refetch() },
    validateSchema: instrumentTypeSchema,
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<InstrumentType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    name: "",
  })

  const handleOpenDialog = (type?: InstrumentType) => {
    if (type) {
      setEditingType(type)
      setFormData({
        code: type.code,
        name: type.name,
      })
    } else {
      setEditingType(null)
      setFormData({
        code: "",
        name: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const result = editingType 
      ? await update(formData)
      : await create(formData)

    if (result) {
      setIsDialogOpen(false)
      setEditingType(null)
      setFormData({ code: "", name: "" })
    }
  }

  const handleDelete = async (code: string) => {
    const result = await remove({ code })
    if (result) {
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const isLoading = loading || operationLoading

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Tipos de Instrumento</CardTitle>
            <CardDescription>Crear, editar y eliminar tipos de instrumentos financieros</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingType ? "Editar Tipo de Instrumento" : "Crear Tipo de Instrumento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                    placeholder="Ej: stock, bond, cash"
                    disabled={!!editingType}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Acción, Bono, Efectivo"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingType ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && types.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No hay tipos de instrumento registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((type) => (
                  <TableRow key={type.code}>
                    <TableCell className="font-mono font-semibold">{type.code}</TableCell>
                    <TableCell>{type.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(type)}
                          disabled={isLoading}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(type.code)
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
          <AlertDialogTitle>Eliminar Tipo de Instrumento</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que deseas eliminar este tipo de instrumento? Esta acción no se puede deshacer y podría afectar instrumentos existentes.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
