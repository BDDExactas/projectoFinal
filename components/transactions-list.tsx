"use client"

import { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUpRight, Plus, Minus } from "lucide-react"
import type { TransactionHistory } from "@/lib/db-types"
import { format } from "date-fns"
import { formatMoney, formatNumber } from "@/lib/format"
import { useApiQuery } from "@/hooks/use-api"

export function TransactionsList({ userEmail }: { userEmail: string }) {
  const selectTransactions = useCallback((json: any) => json.transactions || [], [])
  const { data: transactions = [], loading } = useApiQuery<TransactionHistory[]>(
    `/api/dashboard/transactions?userEmail=${encodeURIComponent(userEmail)}&limit=20`,
    { select: selectTransactions, initialData: [] },
  )

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "buy":
      case "deposit":
        return <Plus className="h-4 w-4 text-green-500" />
      case "sell":
      case "withdrawal":
        return <Minus className="h-4 w-4 text-red-500" />
      default:
        return <ArrowUpRight className="h-4 w-4 text-blue-500" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacciones Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay transacciones registradas</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.transaction_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">{getTransactionIcon(tx.transaction_type)}</div>
                    <div>
                      <div className="font-medium">{tx.instrument_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(tx.transaction_date), "dd/MM/yyyy")} • {tx.account_name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {tx.transaction_type === "buy" || tx.transaction_type === "deposit" ? "+" : "-"}
                      {formatNumber(tx.quantity)}
                    </div>
                    {tx.total_amount && (
                      <div className="text-sm text-muted-foreground">
                        ${formatMoney(tx.total_amount, tx.currency_code)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
