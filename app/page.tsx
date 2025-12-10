"use client"

import { PortfolioOverview } from "@/components/portfolio-overview"
import { HoldingsTable } from "@/components/holdings-table"
import { PerformanceChart } from "@/components/performance-chart"
import { TransactionsList } from "@/components/transactions-list"
import { TransactionsCrud } from "@/components/transactions-crud"
import { PriceTracking } from "@/components/price-tracking"
import { InstrumentsCrud } from "@/components/instruments-crud"
import { DatabaseInitializer } from "@/components/database-initializer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { LoginCard } from "@/components/login-card"
import { useCurrentUser } from "@/hooks/use-current-user"
import { BarChart3, LogOut } from "lucide-react"

export default function DashboardPage() {
  const { user, loading, setUser, logout } = useCurrentUser()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando sesión...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <LoginCard onLogin={(authenticatedUser) => setUser(authenticatedUser)} />
      </div>
    )
  }

  const userEmail = user.email

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Plataforma Financiera</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">{user.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await logout()
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <DatabaseInitializer />
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="holdings">Tenencias</TabsTrigger>
            <TabsTrigger value="prices">Precios</TabsTrigger>
            <TabsTrigger value="instruments">Instrumentos</TabsTrigger>
            <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <PortfolioOverview userEmail={userEmail} />

            <div className="grid gap-6 lg:grid-cols-2">
              <PerformanceChart />
              <TransactionsList userEmail={userEmail} />
            </div>
          </TabsContent>

          <TabsContent value="holdings" className="space-y-6">
            <HoldingsTable userEmail={userEmail} />
          </TabsContent>

          <TabsContent value="prices" className="space-y-6">
            <PriceTracking />
          </TabsContent>

          <TabsContent value="instruments" className="space-y-6">
            <InstrumentsCrud />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <TransactionsCrud userEmail={userEmail} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
