"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { UserCheck, Phone, AlertTriangle, XCircle, CheckSquare, Square, PhoneCall } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatutBadge } from "@/components/patients/statut-badge"

export function RdvDuJour() {
  const utils = trpc.useUtils()
  const { data: rdvs, isLoading } = trpc.dashboard.rdvDuJour.useQuery(undefined, {
    refetchInterval: 30_000,
  })
  const [filtreP, setFiltreP] = useState<string>("tous")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [callingId, setCallingId] = useState<string | null>(null)

  const appelerPatient = async (rdvId: string) => {
    setCallingId(rdvId)
    try {
      const res = await fetch("/api/voice/appeler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rdvId }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) toast.success("Appel initié — le patient sera contacté dans quelques secondes.")
      else toast.error(data.error ?? "Erreur lors de l'appel")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setCallingId(null)
    }
  }

  const updateStatut = trpc.rendezVous.updateStatut.useMutation({
    onSuccess: () => { utils.dashboard.rdvDuJour.invalidate(); utils.dashboard.kpis.invalidate() },
    onError: (e) => toast.error(e.message),
  })

  const bulkUpdate = trpc.rendezVous.bulkUpdateStatut.useMutation({
    onSuccess: ({ updated }) => {
      toast.success(`${updated} RDV mis à jour`)
      setSelected(new Set())
      utils.dashboard.rdvDuJour.invalidate()
      utils.dashboard.kpis.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!rdvs?.length) return <p className="text-sm text-text-tertiary py-4 text-center">Aucun rendez-vous aujourd'hui.</p>

  // Build praticien list for filter
  const praticiens = Array.from(new Map(rdvs.map((r) => [r.praticien.id, r.praticien])).values())
  const filtered = filtreP === "tous" ? rdvs : rdvs.filter((r) => r.praticien.id === filtreP)
  const nonConfirmes = filtered.filter((r) => !r.confirmeParPatient && r.statut !== "ARRIVE" && r.statut !== "COMPLETE" && r.statut !== "NO_SHOW")

  const toggle = (id: string) => setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)))

  return (
    <div className="space-y-2">
      {/* Filters + bulk toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {praticiens.length > 1 && (
          <Select value={filtreP} onValueChange={(v) => setFiltreP(v ?? "tous")}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[130px]">
              <SelectValue placeholder="Tous les praticiens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les praticiens</SelectItem>
              {praticiens.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: p.couleur ?? "#2563EB" }} />
                    {p.prenom} {p.nom}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-text-secondary">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-brand-danger border-brand-danger/30 hover:bg-brand-danger/5"
              disabled={bulkUpdate.isPending}
              onClick={() => bulkUpdate.mutate({ ids: Array.from(selected), statut: "ANNULE" })}>
              <XCircle className="h-3 w-3 mr-1" /> Annuler
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
              disabled={bulkUpdate.isPending}
              onClick={() => bulkUpdate.mutate({ ids: Array.from(selected), statut: "NO_SHOW" })}>
              No-show
            </Button>
          </div>
        )}
      </div>

      {nonConfirmes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {nonConfirmes.length} patient{nonConfirmes.length > 1 ? "s" : ""} n'ont pas encore confirmé
        </div>
      )}

      {/* Select all row */}
      {filtered.length > 1 && (
        <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors px-1">
          {selected.size === filtered.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          Tout sélectionner
        </button>
      )}

      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {filtered.map((rdv) => (
          <div
            key={rdv.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${selected.has(rdv.id) ? "border-brand-primary/40 bg-brand-primary/5" : "border-border bg-bg-secondary hover:bg-bg-tertiary"}`}
            onClick={() => toggle(rdv.id)}
          >
            <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: rdv.praticien.couleur ?? "#2563EB" }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">{rdv.patient.prenom} {rdv.patient.nom}</span>
                <StatutBadge statut={rdv.statut} />
                {rdv.noShowRisk >= 40 && (
                  <span
                    title={`Risque no-show : ${rdv.noShowRisk}%`}
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      rdv.noShowRisk >= 70
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {rdv.noShowRisk >= 70 ? "⚠ Haut risque" : "↑ Risque"}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary">{format(new Date(rdv.dateHeure), "HH:mm")} · {rdv.praticien.prenom} {rdv.praticien.nom}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {rdv.patient.telephone && (
                <a href={`tel:${rdv.patient.telephone}`} className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              {!rdv.confirmeParPatient && rdv.statut !== "ARRIVE" && rdv.statut !== "COMPLETE" && rdv.statut !== "NO_SHOW" && rdv.statut !== "ANNULE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-brand-primary border-brand-primary/30 hover:bg-brand-primary/5"
                  disabled={callingId === rdv.id}
                  title="Appel vocal automatique"
                  onClick={() => void appelerPatient(rdv.id)}
                >
                  <PhoneCall className={`h-3 w-3 ${callingId === rdv.id ? "animate-pulse" : ""}`} />
                </Button>
              )}
              {rdv.statut !== "ARRIVE" && rdv.statut !== "COMPLETE" && rdv.statut !== "NO_SHOW" && rdv.statut !== "ANNULE" && (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                  disabled={updateStatut.isPending}
                  onClick={() => updateStatut.mutate({ id: rdv.id, statut: "ARRIVE" })}>
                  <UserCheck className="h-3 w-3 mr-1" /> Arrivé
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
