"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MousePointerClick, Send, Star, ExternalLink, Check, X } from "lucide-react"
import { trpc } from "@/trpc/client"
import { toast } from "sonner"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export function AvisPage() {
  const utils = trpc.useUtils()

  const { data: stats, isLoading: statsLoading } = trpc.avis.stats.useQuery()
  const { data: config, isLoading: configLoading } = trpc.avis.getConfig.useQuery()
  const { data: liste, isLoading: listeLoading } = trpc.avis.liste.useQuery({ limit: 50 })

  const [actif, setActif] = useState<boolean | undefined>(undefined)
  const [delai, setDelai] = useState<number | undefined>(undefined)
  const [lien, setLien] = useState<string | undefined>(undefined)
  const [message, setMessage] = useState<string | undefined>(undefined)

  const effectifActif = actif ?? config?.actif ?? true
  const effectifDelai = delai ?? config?.delaiApresRdv ?? 2
  const effectifLien = lien ?? config?.lienGoogle ?? ""
  const effectifMessage = message ?? config?.messageSMS ?? ""

  const updateConfig = trpc.avis.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration sauvegardee")
      utils.avis.getConfig.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSave = () => {
    updateConfig.mutate({
      actif: effectifActif,
      delaiApresRdv: effectifDelai,
      lienGoogle: effectifLien,
      messageSMS: effectifMessage,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard title="Envoyes ce mois" value={stats?.totalMois ?? "---"} icon={Send} iconColor="text-brand-primary" isLoading={statsLoading} />
        <KpiCard title="Taux de clic" value={stats ? `${stats.tauxClic}%` : "---"} subtitle={stats ? `${stats.cliqueMois} clics` : undefined} icon={MousePointerClick} iconColor="text-brand-accent" isLoading={statsLoading} />
        <KpiCard title="Total envoyes" value={stats?.totalAll ?? "---"} icon={Star} iconColor="text-brand-warning" isLoading={statsLoading} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Configuration</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">{effectifActif ? "Actif" : "Inactif"}</span>
            <Switch checked={effectifActif} onCheckedChange={(v) => setActif(v)} disabled={configLoading} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {configLoading ? (
            <div className="space-y-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Lien Google My Business</Label>
                  <div className="flex gap-2">
                    <Input value={effectifLien} onChange={(e) => setLien(e.target.value)} placeholder="https://g.page/r/..." />
                    {effectifLien && (
                      <Button variant="outline" size="icon" onClick={() => window.open(effectifLien, "_blank")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Delai apres RDV (heures)</Label>
                  <Input type="number" min={0} max={72} value={effectifDelai} onChange={(e) => setDelai(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Message SMS</Label>
                <Textarea value={effectifMessage} onChange={(e) => setMessage(e.target.value)} rows={3} />
                <p className="text-xs text-text-tertiary">Variables : prenom, lien</p>
              </div>
              <Button onClick={handleSave} disabled={updateConfig.isPending}>
                {updateConfig.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Historique des envois
            {liste && <span className="ml-2 text-sm font-normal text-text-tertiary">({liste.total} au total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listeLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !liste?.items.length ? (
            <p className="py-12 text-center text-sm text-text-tertiary">Aucun avis envoye pour l instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="pb-2 font-medium">Patient</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Clique</th>
                    <th className="pb-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {liste.items.map((avis) => (
                    <tr key={avis.id} className="hover:bg-bg-secondary transition-colors">
                      <td className="py-3 font-medium text-text-primary">{avis.patient.prenom} {avis.patient.nom}</td>
                      <td className="py-3 text-text-secondary">{format(new Date(avis.dateEnvoi), "d MMM yyyy", { locale: fr })}</td>
                      <td className="py-3">
                        {avis.aClique ? (
                          <Badge className="bg-brand-accent/10 text-brand-accent border-0 gap-1"><Check className="h-3 w-3" /> Oui</Badge>
                        ) : (
                          <Badge variant="outline" className="text-text-tertiary gap-1"><X className="h-3 w-3" /> Non</Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {avis.noteObtenue != null ? (
                          <span className="flex items-center gap-1 text-brand-warning font-medium"><Star className="h-3.5 w-3.5 fill-current" />{avis.noteObtenue}/5</span>
                        ) : (
                          <span className="text-text-tertiary">---</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
