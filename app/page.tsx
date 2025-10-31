import { PortfolioOverview } from "@/components/portfolio-overview"
import { HoldingsTable } from "@/components/holdings-table"
import { PerformanceChart } from "@/components/performance-chart"
import { TransactionsList } from "@/components/transactions-list"
import { FileUpload } from "@/components/file-upload"
import { PriceTracking } from "@/components/price-tracking"
import { DatabaseInitializer } from "@/components/database-initializer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3 } from "lucide-react"

export default function DashboardPage() {
  const userId = 1

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Plataforma Financiera</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <DatabaseInitializer />
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="holdings">Tenencias</TabsTrigger>
            <TabsTrigger value="prices">Precios</TabsTrigger>
            <TabsTrigger value="upload">Cargar Datos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <PortfolioOverview userId={userId} />

            <div className="grid gap-6 lg:grid-cols-2">
              <PerformanceChart />
              <TransactionsList userId={userId} />
            </div>
          </TabsContent>

          <TabsContent value="holdings" className="space-y-6">
            <HoldingsTable userId={userId} />
          </TabsContent>

          <TabsContent value="prices" className="space-y-6">
            <PriceTracking />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <FileUpload userId={userId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
