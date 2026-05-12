"use client"

import { useState } from "react"
import { Clock, Bell, Check, X, Plus, Phone } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AjouterProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}

function AjouterDialog({ open, onOpenChange, onSuccess }: AjouterProps) {
  const [patientSearch, setPatientSearch] = useState("")
  const [patientId, setPatientId] = useState("")
  const [typeRdv, setTypeRdv] = useState("")
  const [duree, setDuree] = useState(60)
  const [notes, setNotes] = useState("")

  const { data: patientsData } = trpc.patient.liste.useQuery(
    { recherche: patientSearch, actif: true, perPage: 8 },
    { enabled: open && patientSearch.length >= 2 }
  )

  const ajouterMutation = trpc.listeAttente.ajouter.useMutation({
    onSuccess: () => {
      toast.success("Patient ajouté à la liste d'attente.")
      onOpenChange(false)
      setPatientSearch("")
      setPatientId("")
      setTypeRdv("")
      setNotes("")
      onSuccess()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter à la liste d'attente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Patient</Label>
            <Input
              placeholder="Rechercher un patient…"
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setPatientId("") }}
            />
            {patientsData?.patients.length && patientSearch && !patientId ? (
              <div className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                {patientsData.patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors"
                    onClick={() => { setPatientId(p.id); setPatientSearch(`${p.prenom} ${p.nom}`) }}
                  >
                    <span className="font-medium">{p.prenom} {p.nom}</span>
                    <span className="ml-2 text-text-tertiary font-mono text-xs">{p.telephone}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type de RDV</Label>
              <Input placeholder="Ex: Nettoyage, Suivi…" value={typeRdv} onChange={(e) => setTypeRdv(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Durée (min)</Label>
              <Select value={String(duree)} onValueChange={(v) => setDuree(parseInt(v ?? "60"))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Input placeholder="Disponibilités, préférences…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              disabled={!patientId || ajouterMutation.isPending}
              onClick={() => ajouterMutation.mutate({ patientId, typeRdv: typeRdv || undefined, dureeMinutes: duree, notes: notes || undefined })}
            >
              {ajouterMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ListeAttenteWidget() {
  const utils = trpc.useUtils()
  const [showAjouter, setShowAjouter] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: liste, isLoading } = (trpc.listeAttente.liste as any).useQuery({ statut: "EN_ATTENTE" })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifierMutation = (trpc.listeAttente.notifier as any).useMutation({
    onSuccess: (data: { smsSent: boolean }) => {
      utils.listeAttente.liste.invalidate()
      toast.success(data.smsSent ? "Patient notifié par SMS." : "Statut mis à jour (pas de consentement SMS).")
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retirerMutation = (trpc.listeAttente.retirer as any).useMutation({
    onSuccess: () => { utils.listeAttente.liste.invalidate(); toast.success("Retiré de la liste.") },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const items = (liste ?? []) as Array<{
    id: string
    typeRdv: string | null
    dureeMinutes: number
    notes: string | null
    createdAt: string
    statut: string
    notifieLe: string | null
    patient: { id: string; prenom: string; nom: string; telephone: string }
    praticien: { prenom: string; nom: string; couleur: string | null } | null
  }>

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium">
              Liste d'attente
              {items.length > 0 && (
                <Badge className="ml-2 bg-brand-primary/10 text-brand-primary border-0 text-xs">
                  {items.length}
                </Badge>
              )}
            </span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAjouter(true)}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter
          </Button>
        </div>

        {isLoading && <Skeleton className="h-20 w-full" />}

        {!isLoading && items.length === 0 && (
          <p className="text-xs text-text-tertiary text-center py-3">Aucun patient en attente</p>
        )}

        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-secondary px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.patient.prenom} {item.patient.nom}</span>
                  {item.statut === "NOTIFIE" && (
                    <Badge className="bg-blue-100 text-blue-600 border-0 text-xs">Notifié</Badge>
                  )}
                </div>
                <p className="text-xs text-text-tertiary">
                  {item.typeRdv ? `${item.typeRdv} · ` : ""}{item.dureeMinutes} min
                  {item.notifieLe ? ` · Notifié ${format(new Date(item.notifieLe), "d MMM", { locale: fr })}` : ""}
                  {" · En attente depuis "}
                  {format(new Date(item.createdAt), "d MMM", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`tel:${item.patient.telephone}`}
                  className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                  title="Appeler"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-brand-primary border-brand-primary/30"
                  disabled={notifierMutation.isPending}
                  title="Notifier par SMS qu'un créneau est disponible"
                  onClick={() => notifierMutation.mutate({ id: item.id })}
                >
                  <Bell className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-text-tertiary hover:text-brand-danger"
                  disabled={retirerMutation.isPending}
                  onClick={() => retirerMutation.mutate({ id: item.id })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AjouterDialog
        open={showAjouter}
        onOpenChange={setShowAjouter}
        onSuccess={() => utils.listeAttente.liste.invalidate()}
      />
    </>
  )
}
