"use client"

import { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet } from "lucide-react"
import type { PortfolioTotal } from "@/lib/db-types"
import { formatMoney } from "@/lib/format"
import { useApiQuery } from "@/hooks/use-api"

export function PortfolioOverview({ userEmail }: { userEmail: string }) {
  const selectPortfolios = useCallback((json: any) => json.portfolios || [], [])
  const { data: portfolios = [], loading } = useApiQuery<PortfolioTotal[]>(
    `/api/dashboard/portfolio-totals?userEmail=${encodeURIComponent(userEmail)}`,
    { select: selectPortfolios, initialData: [] },
  )

  const baseCurrency = portfolios[0]?.base_currency_code || "ARS"
  const totalValueBase = portfolios.reduce((sum, p) => sum + Number(p.total_value_base ?? p.total_value), 0)

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted/50" />
            <CardContent className="h-24 bg-muted/30" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6 text-primary" />
            Valor Total del Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {baseCurrency} ${formatMoney(totalValueBase, baseCurrency)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {portfolios.length} cuenta{portfolios.length !== 1 ? "s" : ""} activa{portfolios.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((portfolio) => (
          <Card
            key={`${portfolio.account_user_email}:${portfolio.account_name}:${portfolio.currency_code}`}
            className="hover:border-primary/50 transition-colors"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">{portfolio.account_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {baseCurrency} ${formatMoney(Number(portfolio.total_value_base ?? portfolio.total_value), baseCurrency)}
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span>{portfolio.instruments_count} instrumentos</span>
                <span>•</span>
                <span>{portfolio.currency_code}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
