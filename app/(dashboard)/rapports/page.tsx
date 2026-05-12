"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { TrendingDown, CheckCircle2, Star, DollarSign, FileText, Users, MessageSquare, Download } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Topbar } from "@/components/dashboard/topbar"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const STATUT_COLORS: Record<string, string> = {
  CONFIRME: "#10B981",
  COMPLETE: "#2563EB",
  PLANIFIE: "#94A3B8",
  NO_SHOW: "#EF4444",
  ANNULE: "#F59E0B",
  ARRIVE: "#8B5CF6",
  REPLANIFIE: "#64748B",
}

const STATUT_LABELS: Record<string, string> = {
  CONFIRME: "Confirmé",
  COMPLETE: "Complété",
  PLANIFIE: "Planifié",
  NO_SHOW: "No-show",
  ANNULE: "Annulé",
  ARRIVE: "Arrivé",
  REPLANIFIE: "Replanifié",
}

export default function RapportsPage() {
  const now = new Date()
  const [annee, setAnnee] = useState(now.getFullYear())
  const [mois, setMois] = useState(now.getMonth() + 1)

  const { data: mensuel, isLoading: mensuelLoading } = trpc.rapport.mensuel.useQuery({ annee, mois })
  const { data: parSemaine, isLoading: semaineLoading } = trpc.rapport.noShowsParSemaine.useQuery({ moisPasses: 3 })
  const { data: repartition, isLoading: repartitionLoading } = trpc.rapport.repartitionStatuts.useQuery({ annee, mois })
  const { data: avisParMois, isLoading: avisLoading } = trpc.rapport.avisParMois.useQuery({ moisPasses: 6 })
  const { data: statsPraticiens, isLoading: praticiensLoading } = trpc.rapport.statsParPraticien.useQuery({ annee, mois })

  const moisLabel = format(new Date(annee, mois - 1, 1), "MMMM yyyy", { locale: fr })

  const prevMois = () => {
    if (mois === 1) { setMois(12); setAnnee((a) => a - 1) }
    else setMois((m) => m - 1)
  }
  const nextMois = () => {
    if (mois === 12) { setMois(1); setAnnee((a) => a + 1) }
    else setMois((m) => m + 1)
  }
  const isCurrentMonth = annee === now.getFullYear() && mois === now.getMonth() + 1

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Topbar title="Rapports" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMois}>←</Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">{moisLabel}</span>
          <Button variant="outline" size="sm" onClick={nextMois} disabled={isCurrentMonth}>→</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/pdf/rapport?annee=${annee}&mois=${mois}`, "_blank")}
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total RDV"
          value={mensuel?.totalRdv ?? "—"}
          icon={CheckCircle2}
          iconColor="text-brand-primary"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="No-shows"
          value={mensuel ? `${mensuel.noShows} (${mensuel.tauxNoShow}%)` : "—"}
          icon={TrendingDown}
          iconColor="text-brand-danger"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="Revenus récupérés"
          value={mensuel ? `${mensuel.revenusRecuperes} $` : "—"}
          subtitle={mensuel ? `${mensuel.noShowsEvites} no-shows évités` : undefined}
          icon={DollarSign}
          iconColor="text-brand-accent"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="Avis Google"
          value={mensuel?.avisEnvoyes ?? "—"}
          icon={Star}
          iconColor="text-brand-warning"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="Formulaires complétés"
          value={mensuel?.formulairesComplete ?? "—"}
          icon={FileText}
          iconColor="text-brand-primary"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="Taux de confirmation"
          value={mensuel ? `${mensuel.tauxConfirmation}%` : "—"}
          subtitle={mensuel ? `${mensuel.confirmes} sur ${mensuel.totalRdv}` : undefined}
          icon={Users}
          iconColor="text-brand-accent"
          isLoading={mensuelLoading}
        />
        <KpiCard
          title="Relances envoyées"
          value={mensuel?.relancesEnvoyees ?? "—"}
          icon={MessageSquare}
          iconColor="text-text-secondary"
          isLoading={mensuelLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* No-shows par semaine */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">No-shows par semaine (3 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {semaineLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <BarChart data={parSemaine} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="semaine"
                    tickFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMM", { locale: fr })}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                    labelFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMMM", { locale: fr })}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" name="Total RDV" fill="#E2E8F0" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="noShows" name="No-shows" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Répartition statuts */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Répartition des statuts</CardTitle>
          </CardHeader>
          <CardContent>
            {repartitionLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : !repartition?.length ? (
              <p className="text-sm text-text-tertiary text-center py-12">Aucune donnée pour cette période.</p>
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <PieChart>
                  <Pie
                    data={repartition}
                    dataKey="count"
                    nameKey="statut"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${STATUT_LABELS[name as string] ?? name} (${Math.round((percent ?? 0) * 100)}%)`
                    }
                    labelLine={false}
                  >
                    {repartition.map((entry) => (
                      <Cell key={entry.statut} fill={STATUT_COLORS[entry.statut] ?? "#94A3B8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                    formatter={(value, name) => [value, STATUT_LABELS[name as string] ?? name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Avis Google par mois */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Croissance avis Google (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {avisLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <LineChart
                  data={avisParMois?.map((d) => ({
                    ...d,
                    label: format(new Date(d.mois + "T12:00:00"), "MMM yyyy", { locale: fr }),
                  }))}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Avis envoyés"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#F59E0B" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats par praticien */}
      {(praticiensLoading || (statsPraticiens && statsPraticiens.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Performance par praticien — {moisLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {praticiensLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !statsPraticiens?.length ? null : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-text-secondary">Praticien</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">RDV</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">No-shows</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">Taux no-show</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">Confirmés</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">Taux confirm.</th>
                      <th className="text-right py-2 pl-3 font-medium text-text-secondary">Rev. récupérés</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {statsPraticiens.map((p) => (
                      <tr key={p.id} className="hover:bg-bg-secondary/50 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.couleur ?? "#2563EB" }}
                            />
                            <span className="font-medium">{p.prenom} {p.nom}</span>
                            {p.specialite && (
                              <span className="text-xs text-text-tertiary">· {p.specialite}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">{p.total}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={p.noShows > 0 ? "text-brand-danger" : ""}>{p.noShows}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-medium ${p.tauxNoShow >= 20 ? "text-brand-danger" : p.tauxNoShow >= 10 ? "text-brand-warning" : "text-brand-accent"}`}>
                            {p.tauxNoShow}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">{p.confirmes}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-medium ${p.tauxConfirmation >= 80 ? "text-brand-accent" : p.tauxConfirmation >= 60 ? "text-brand-warning" : "text-brand-danger"}`}>
                            {p.tauxConfirmation}%
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right font-mono text-brand-accent">
                          {p.revenusRecuperes > 0 ? `${p.revenusRecuperes} $` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {statsPraticiens.length > 1 && (
                    <tfoot className="border-t-2 border-border">
                      <tr>
                        <td className="py-2 pr-4 font-semibold text-text-primary">Total</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {statsPraticiens.reduce((s, p) => s + p.total, 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-brand-danger">
                          {statsPraticiens.reduce((s, p) => s + p.noShows, 0)}
                        </td>
                        <td className="py-2 px-3" />
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {statsPraticiens.reduce((s, p) => s + p.confirmes, 0)}
                        </td>
                        <td className="py-2 px-3" />
                        <td className="py-2 pl-3 text-right font-mono font-semibold text-brand-accent">
                          {statsPraticiens.reduce((s, p) => s + p.revenusRecuperes, 0)} $
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
