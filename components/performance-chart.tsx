"use client"

import { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { InstrumentPerformance } from "@/lib/db-types"
import { useApiQuery } from "@/hooks/use-api"

export function PerformanceChart() {
  const PERFORMANCE_POLL_MS = 120_000
  const selectPerformance = useCallback((json: any) => json.performance || [], [])
  const { data: performance = [], loading } = useApiQuery<InstrumentPerformance[]>("/api/dashboard/performance", {
    select: selectPerformance,
    initialData: [],
    pollIntervalMs: PERFORMANCE_POLL_MS,
  })

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de Instrumentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    )
  }

  const chartData = performance.slice(0, 10).map((item) => ({
    instrument: item.instrument_code,
    change: Number(item.price_change_percent),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento de Instrumentos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            change: {
              label: "Cambio %",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="instrument" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="change" fill="var(--color-change)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
