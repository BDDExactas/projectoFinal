"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react"
import { z } from "zod"
import { useFetchData } from "@/hooks/use-fetch-data"
import { useCrudOperations } from "@/hooks/use-crud-operations"

const instrumentSchema = z.object({
  code: z.string().min(1, "El código es requerido").trim(),
  instrument_type_code: z.string().min(1, "El tipo de instrumento es requerido").trim(),
  name: z.string().min(1, "El nombre es requerido").trim(),
  external_symbol: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
  description: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
})

interface Instrument {
  code: string
  instrument_type_code: string
  name: string
  external_symbol?: string
  description?: string
  created_at: string
}

interface InstrumentType {
  code: string
  name: string
}

interface InstrumentsResponse {
  instruments: Instrument[]
}

interface InstrumentTypesResponse {
  types: InstrumentType[]
}

export function InstrumentsCrud() {
  const { data: instrumentsData, loading: instrumentsLoading, refetch } = useFetchData<InstrumentsResponse>(
    "/api/instruments",
    {
      errorTitle: "Error",
      errorDescription: "No se pudieron cargar los instrumentos",
    }
  )

  const { data: typesData } = useFetchData<InstrumentTypesResponse>(
    "/api/instrument-types",
    {
      errorTitle: "Error",
      errorDescription: "No se pudieron cargar los tipos de instrumento",
    }
  )

  const instruments = instrumentsData?.instruments || []
  const instrumentTypes = typesData?.types || []

  const { create, update, remove, loading: crudLoading } = useCrudOperations({
    entityName: "Instrumento",
    apiEndpoint: "/api/instruments",
    onSuccess: async () => {
      await refetch()
      setIsDialogOpen(false)
      setEditingInstrument(null)
      setFormData({ code: "", instrument_type_code: "", name: "", external_symbol: "", description: "" })
    },
    validateSchema: instrumentSchema,
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    instrument_type_code: "",
    name: "",
    external_symbol: "",
    description: "",
  })

  const handleOpenDialog = (instrument?: Instrument) => {
    if (instrument) {
      setEditingInstrument(instrument)
      setFormData({
        code: instrument.code,
        instrument_type_code: instrument.instrument_type_code,
        name: instrument.name,
        external_symbol: instrument.external_symbol || "",
        description: instrument.description || "",
      })
    } else {
      setEditingInstrument(null)
      setFormData({
        code: "",
        instrument_type_code: "",
        name: "",
        external_symbol: "",
        description: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (editingInstrument) {
      await update(formData)
    } else {
      await create(formData)
    }
  }

  const handleDelete = async (code: string) => {
    await remove({ code })
    setIsDeleteDialogOpen(false)
    setDeleteTarget(null)
  }

  const isLoading = instrumentsLoading || crudLoading

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Instrumentos</CardTitle>
            <CardDescription>Crear, editar y eliminar instrumentos financieros</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Instrumento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingInstrument ? "Editar Instrumento" : "Crear Instrumento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: AL30"
                    disabled={!!editingInstrument}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Instrumento *</Label>
                  <Select value={formData.instrument_type_code} onValueChange={(value) => setFormData({ ...formData, instrument_type_code: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {instrumentTypes.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Bono Argentino 2030"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="symbol">Símbolo Externo</Label>
                  <Input
                    id="symbol"
                    value={formData.external_symbol}
                    onChange={(e) => setFormData({ ...formData, external_symbol: e.target.value })}
                    placeholder="Ej: AL30D.BA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del instrumento"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {crudLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingInstrument ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {instrumentsLoading && instruments.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : instruments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No hay instrumentos registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Símbolo Externo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((instrument) => (
                  <TableRow key={instrument.code}>
                    <TableCell className="font-mono font-semibold">{instrument.code}</TableCell>
                    <TableCell>{instrument.instrument_type_code}</TableCell>
                    <TableCell>{instrument.name}</TableCell>
                    <TableCell className="text-muted-foreground">{instrument.external_symbol || "-"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{instrument.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(instrument)}
                          disabled={isLoading}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(instrument.code)
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
          <AlertDialogTitle>Eliminar Instrumento</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que deseas eliminar este instrumento? Esta acción no se puede deshacer.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {crudLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
