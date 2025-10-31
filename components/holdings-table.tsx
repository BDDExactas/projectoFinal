"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { AccountValuation } from "@/lib/db-types"

export function HoldingsTable({ userId }: { userId: number }) {
  const [holdings, setHoldings] = useState<AccountValuation[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [userId])

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
                    ${Number(holding.current_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    ${Number(holding.valuation).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
