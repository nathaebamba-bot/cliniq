"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MessageSquare, Star, RefreshCw, Bell, Settings, Activity, Play } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { RappelConfig } from "./rappel-config"
import { FormulaireConfig } from "./formulaire-config"
import { AvisConfig } from "./avis-config"
import { RelanceConfig } from "./relance-config"
import type { TypeAutomatisation } from "@prisma/client"

const JOB_KEY: Partial<Record<TypeAutomatisation, string>> = {
  RAPPEL_RDV: "rappels",
  COLLECTE_AVIS: "avis",
  FORMULAIRE_ANAMNE: "formulaires",
  RELANCE_TRAITEMENT: "relance",
}

interface AutoCardConfig {
  type: TypeAutomatisation
  nom: string
  description: string
  icon: React.ReactNode
  color: string
}

const AUTO_CONFIG: AutoCardConfig[] = [
  {
    type: "RAPPEL_RDV",
    nom: "Rappels rendez-vous",
    description: "Envoie automatiquement des SMS de rappel 48h, 24h et 2h avant chaque RDV.",
    icon: <Bell className="h-5 w-5" />,
    color: "text-blue-600 bg-blue-50",
  },
  {
    type: "FORMULAIRE_ANAMNE",
    nom: "Formulaires anamnèse",
    description: "Envoie un lien de formulaire pré-consultation 48h avant le premier RDV.",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    type: "COLLECTE_AVIS",
    nom: "Collecte d'avis Google",
    description: "Envoie automatiquement une demande d'avis après chaque consultation complétée.",
    icon: <Star className="h-5 w-5" />,
    color: "text-amber-600 bg-amber-50",
  },
  {
    type: "RELANCE_TRAITEMENT",
    nom: "Relances traitements",
    description: "Relance les patients dont un traitement n'a pas été complété depuis X jours.",
    icon: <RefreshCw className="h-5 w-5" />,
    color: "text-green-600 bg-green-50",
  },
]

export function AutomatisationsList() {
  const utils = trpc.useUtils()
  const [configOpen, setConfigOpen] = useState<TypeAutomatisation | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)

  const { data: automations, isLoading } = trpc.automatisation.liste.useQuery()
  const { data: stats } = trpc.automatisation.getStats.useQuery()

  const toggleMutation = trpc.automatisation.toggleActif.useMutation({
    onSuccess: () => utils.automatisation.liste.invalidate(),
    onError: (e) => toast.error(e.message),
  })

  const triggerJob = async (jobKey: string, nom: string) => {
    setTriggering(jobKey)
    try {
      const res = await fetch("/api/test-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobKey }),
      })
      const data = await res.json() as { envoyes?: number; ignores?: number; error?: string }
      if (data.error) { toast.error(data.error); return }
      toast.success(
        `${nom} — ${data.envoyes ?? 0} envoyé${(data.envoyes ?? 0) !== 1 ? "s" : ""}, ${data.ignores ?? 0} ignoré${(data.ignores ?? 0) !== 1 ? "s" : ""}`,
        { duration: 6000 }
      )
      utils.automatisation.liste.invalidate()
    } catch {
      toast.error("Erreur lors du déclenchement.")
    } finally {
      setTriggering(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
    )
  }

  const getAutoData = (type: TypeAutomatisation) =>
    automations?.find((a) => a.type === type)

  return (
    <>
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Rappels ce mois" value={stats.rappelEnvoyes} color="blue" />
          <StatCard label="Avis demandés" value={stats.avisEnvoyes} color="amber" />
          <StatCard label="Relances envoyées" value={stats.relancesEnvoyees} color="green" />
          <StatCard label="Formulaires envoyés" value={stats.formsSent} color="indigo" />
        </div>
      )}

      {/* Automation cards */}
      <div className="space-y-3">
        {AUTO_CONFIG.map((cfg) => {
          const data = getAutoData(cfg.type)
          return (
            <Card key={cfg.type} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`rounded-xl p-3 ${cfg.color} flex-shrink-0`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{cfg.nom}</h3>
                          {data && (
                            <Badge
                              className={`text-xs border-0 ${
                                data.actif
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {data.actif ? "Actif" : "Inactif"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-text-secondary mt-0.5">{cfg.description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {JOB_KEY[cfg.type] && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-text-secondary"
                            disabled={triggering === JOB_KEY[cfg.type]}
                            onClick={() => triggerJob(JOB_KEY[cfg.type]!, cfg.nom)}
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            {triggering === JOB_KEY[cfg.type] ? "En cours…" : "Déclencher"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-secondary"
                          onClick={() => setConfigOpen(cfg.type)}
                        >
                          <Settings className="h-4 w-4 mr-1.5" />
                          Config
                        </Button>
                        {data && (
                          <Switch
                            checked={data.actif}
                            onCheckedChange={(v) =>
                              toggleMutation.mutate({ id: data.id, actif: v })
                            }
                          />
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    {data && (
                      <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5" />
                          {data.totalDeclenche} déclenchements
                        </span>
                        {data.totalSucces > 0 && (
                          <span className="text-green-600">
                            {data.totalSucces} succès
                          </span>
                        )}
                        {data.totalEchec > 0 && (
                          <span className="text-red-500">
                            {data.totalEchec} échecs
                          </span>
                        )}
                        {data.dernierDeclenchement && (
                          <span>
                            Dernier :{" "}
                            {format(
                              new Date(data.dernierDeclenchement),
                              "d MMM à HH:mm",
                              { locale: fr }
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Config sheet */}
      <Sheet open={!!configOpen} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <SheetContent side="right" className="w-[480px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>
              {AUTO_CONFIG.find((c) => c.type === configOpen)?.nom ?? "Configuration"}
            </SheetTitle>
          </SheetHeader>
          {configOpen === "RAPPEL_RDV" && <RappelConfig />}
          {configOpen === "FORMULAIRE_ANAMNE" && <FormulaireConfig />}
          {configOpen === "COLLECTE_AVIS" && <AvisConfig />}
          {configOpen === "RELANCE_TRAITEMENT" && <RelanceConfig />}
        </SheetContent>
      </Sheet>
    </>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    amber: "text-amber-600",
    green: "text-green-600",
    indigo: "text-indigo-600",
  }
  return (
    <div className="rounded-card border border-border p-4 bg-bg-primary">
      <p className={`text-2xl font-bold font-display ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
    </div>
  )
}
