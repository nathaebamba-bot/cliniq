"use client"

import dynamic from "next/dynamic"
import { TrendingDown, CheckCircle2, Star, DollarSign } from "lucide-react"
import { Topbar } from "@/components/dashboard/topbar"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { RdvDuJour } from "@/components/dashboard/rdv-du-jour"
import { AlertesSection } from "@/components/dashboard/alertes-section"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/trpc/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ListeAttenteWidget } from "@/components/dashboard/liste-attente-widget"

const NoShowChart = dynamic(
  () => import("@/components/dashboard/no-show-chart").then((m) => ({ default: m.NoShowChart })),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
)

export default function DashboardPage() {
  const { data: kpis, isLoading } = trpc.dashboard.kpis.useQuery()

  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Tableau de bord" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="No-shows cette semaine"
          value={kpis?.noShowsSemaine ?? "—"}
          icon={TrendingDown}
          iconColor="text-brand-danger"
          delta={kpis?.noShowsDelta}
          deltaLabel="vs semaine passée"
          invertDelta
          isLoading={isLoading}
        />
        <KpiCard
          title="RDV confirmés"
          value={kpis ? `${kpis.tauxConfirmation}%` : "—"}
          subtitle={kpis ? `${kpis.rdvConfirmesSemaine} / ${kpis.rdvTotalSemaine}` : undefined}
          icon={CheckCircle2}
          iconColor="text-brand-accent"
          isLoading={isLoading}
        />
        <KpiCard
          title="Avis Google ce mois"
          value={kpis?.avisGoogle ?? "—"}
          icon={Star}
          iconColor="text-brand-warning"
          isLoading={isLoading}
        />
        <KpiCard
          title="Revenus récupérés"
          value={kpis ? `${kpis.revenusRecuperes} $` : "—"}
          subtitle={kpis ? `${kpis.noShowsEvites} no-shows évités` : undefined}
          icon={DollarSign}
          iconColor="text-brand-primary"
          isLoading={isLoading}
        />
      </div>

      {/* Chart */}
      <NoShowChart />

      {/* Today + Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">
              Aujourd'hui · {format(new Date(), "EEEE d MMMM", { locale: fr })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RdvDuJour />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Actions requises</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertesSection />
          </CardContent>
        </Card>
      </div>

      {/* Liste d'attente */}
      <Card>
        <CardContent className="pt-4">
          <ListeAttenteWidget />
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed />
        </CardContent>
      </Card>
    </div>
  )
}
