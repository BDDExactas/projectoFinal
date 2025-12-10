"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react"

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

export function InstrumentsCrud() {
  const { toast } = useToast()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrumentTypes, setInstrumentTypes] = useState<InstrumentType[]>([])
  const [loading, setLoading] = useState(false)
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

  const fetchInstruments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/instruments")
      if (!response.ok) throw new Error("Error al cargar instrumentos")
      const data = await response.json()
      setInstruments(data.instruments || [])
    } catch (error) {
      console.error("Fetch error:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los instrumentos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchInstrumentTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/instruments/types")
      if (response.ok) {
        const data = await response.json()
        setInstrumentTypes(data.types || [])
      }
    } catch (error) {
      console.error("Fetch types error:", error)
    }
  }, [])

  useEffect(() => {
    fetchInstruments()
    fetchInstrumentTypes()
  }, [fetchInstruments, fetchInstrumentTypes])

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
    if (!formData.code || !formData.instrument_type_code || !formData.name) {
      toast({
        title: "Validación",
        description: "Code, Tipo y Nombre son requeridos",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const method = editingInstrument ? "PUT" : "POST"
      const response = await fetch("/api/instruments", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al guardar")
      }

      toast({
        title: "Éxito",
        description: `Instrumento ${editingInstrument ? "actualizado" : "creado"} correctamente`,
      })

      setIsDialogOpen(false)
      setEditingInstrument(null)
      await fetchInstruments()
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar instrumento",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (code: string) => {
    try {
      setLoading(true)
      const response = await fetch("/api/instruments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al eliminar")
      }

      toast({
        title: "Éxito",
        description: "Instrumento eliminado correctamente",
      })

      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      await fetchInstruments()
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar instrumento",
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
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingInstrument ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading && instruments.length === 0 ? (
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
                          disabled={loading}
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
          <AlertDialogTitle>Eliminar Instrumento</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que deseas eliminar este instrumento? Esta acción no se puede deshacer.
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
