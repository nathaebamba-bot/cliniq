"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { ExternalLink, Clock, User, Pencil, Trash2, X, Check, Send, FileText, Loader2, Star } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatutBadge } from "@/components/patients/statut-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import type { StatutRdv } from "@prisma/client"

interface RdvItem {
  id: string
  dateHeure: Date
  dureeMinutes: number
  typeRdv: string | null
  notes: string | null
  statut: StatutRdv
  avisEnvoye: boolean
  patient: { id: string; prenom: string; nom: string; telephone: string }
  praticien: { id: string; prenom: string; nom: string; couleur: string | null }
}

interface Props {
  rdv: RdvItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUTS: StatutRdv[] = ["PLANIFIE", "CONFIRME", "ARRIVE", "COMPLETE", "NO_SHOW", "ANNULE", "REPLANIFIE"]
const STATUT_LABELS: Record<StatutRdv, string> = {
  PLANIFIE: "Planifié", CONFIRME: "Confirmé", ARRIVE: "Arrivé",
  COMPLETE: "Complété", NO_SHOW: "No-show", ANNULE: "Annulé", REPLANIFIE: "Replanifié",
}

export function RdvDrawer({ rdv, open, onOpenChange }: Props) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showFactureDialog, setShowFactureDialog] = useState(false)
  const [factureCanal, setFactureCanal] = useState<"EMAIL" | "SMS" | "LES_DEUX">("EMAIL")

  // Edit form state
  const [editDate, setEditDate] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editDuree, setEditDuree] = useState(60)
  const [editPraticienId, setEditPraticienId] = useState("")
  const [editType, setEditType] = useState("")
  const [editNotes, setEditNotes] = useState("")

  const { data: praticiens } = trpc.praticien.list.useQuery(undefined, { enabled: editing })

  useEffect(() => {
    if (rdv && editing) {
      const d = new Date(rdv.dateHeure)
      setEditDate(format(d, "yyyy-MM-dd"))
      setEditTime(format(d, "HH:mm"))
      setEditDuree(rdv.dureeMinutes)
      setEditPraticienId(rdv.praticien.id)
      setEditType(rdv.typeRdv ?? "")
      setEditNotes(rdv.notes ?? "")
    }
  }, [rdv, editing])

  const updateStatutMutation = trpc.rendezVous.updateStatut.useMutation({
    onSuccess: () => { utils.rendezVous.liste.invalidate(); toast.success("Statut mis à jour.") },
    onError: (e) => toast.error(e.message),
  })

  const updateMutation = trpc.rendezVous.update.useMutation({
    onSuccess: () => {
      utils.rendezVous.liste.invalidate()
      toast.success("Rendez-vous modifié.")
      setEditing(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const supprimerMutation = trpc.rendezVous.supprimer.useMutation({
    onSuccess: () => {
      utils.rendezVous.liste.invalidate()
      toast.success("Rendez-vous supprimé.")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const envoyerFactureMutation = trpc.facture.envoyer.useMutation({
    onSuccess: (res) => {
      if (res.ok) toast.success("Facture envoyée au patient.")
      else toast.error(`Erreur envoi: ${res.errors.join(", ")}`)
      setShowFactureDialog(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const envoyerAvisMutation = trpc.avis.envoyerAvisManuel.useMutation({
    onSuccess: () => {
      utils.rendezVous.liste.invalidate()
      toast.success("Lien d'avis Google envoyé par SMS.")
    },
    onError: (e) => toast.error(e.message),
  })

  // Find invoice for this specific RDV from a separate targeted query
  const { data: rdvFacture } = trpc.facture.liste.useQuery(
    { perPage: 1, patientId: rdv?.patient.id },
    { enabled: open && !!rdv?.patient.id && rdv.statut === "COMPLETE", select: (d) => d.factures[0] }
  )

  const handleSaveEdit = () => {
    if (!rdv || !editDate || !editTime) return
    const dateHeure = new Date(`${editDate}T${editTime}:00`)
    updateMutation.mutate({
      id: rdv.id,
      dateHeure,
      dureeMinutes: editDuree,
      praticienId: editPraticienId || undefined,
      typeRdv: editType || undefined,
      notes: editNotes || undefined,
    })
  }

  if (!rdv) return null

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(false) }}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Rendez-vous</SheetTitle>
              <div className="flex items-center gap-1">
                {!editing && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {editing && (
                  <>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={updateMutation.isPending}
                      onClick={handleSaveEdit}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Sauvegarder
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Patient — always read-only */}
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Patient</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{rdv.patient.prenom} {rdv.patient.nom}</p>
                  <p className="text-sm text-text-secondary font-mono">{rdv.patient.telephone}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => router.push(`/patients/${rdv.patient.id}`)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {editing ? (
              /* ── EDIT MODE ── */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Heure</Label>
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Durée (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={editDuree}
                    onChange={(e) => setEditDuree(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Praticien</Label>
                  <Select value={editPraticienId} onValueChange={(v) => setEditPraticienId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {praticiens?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.prenom} {p.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Type de RDV</Label>
                  <Input
                    placeholder="Ex: Bilan initial, Suivi, Nettoyage…"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    placeholder="Notes internes…"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </>
            ) : (
              /* ── READ MODE ── */
              <>
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Praticien</p>
                  <div className="flex items-center gap-2">
                    {rdv.praticien.couleur && (
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: rdv.praticien.couleur }} />
                    )}
                    <p className="font-medium">
                      <User className="h-4 w-4 inline mr-1 text-text-tertiary" />
                      {rdv.praticien.prenom} {rdv.praticien.nom}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Date et heure</p>
                  <p className="font-medium">{format(new Date(rdv.dateHeure), "EEEE d MMMM yyyy", { locale: fr })}</p>
                  <p className="text-sm text-text-secondary flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(rdv.dateHeure), "HH:mm")} — {rdv.dureeMinutes} min
                  </p>
                </div>

                {rdv.typeRdv && (
                  <div>
                    <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Type</p>
                    <p className="text-sm">{rdv.typeRdv}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Statut</p>
                  <div className="flex items-center gap-3">
                    <StatutBadge statut={rdv.statut} />
                    <Select
                      value={rdv.statut}
                      onValueChange={(v) => updateStatutMutation.mutate({ id: rdv.id, statut: v as StatutRdv })}
                    >
                      <SelectTrigger className="h-8 text-xs w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUTS.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUT_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {rdv.notes && (
                  <div>
                    <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{rdv.notes}</p>
                  </div>
                )}

                {rdv.statut === "COMPLETE" && (
                  <div className="pt-2 border-t border-border space-y-4">
                    {/* Facturation */}
                    <div>
                      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Facturation</p>
                      {rdvFacture ? (
                        <div className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-mono text-text-secondary">{rdvFacture.numero}</p>
                            <p className="text-sm font-semibold">{Number(rdvFacture.total).toFixed(2)} $</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => setShowFactureDialog(true)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Envoyer
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-text-tertiary flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          Aucune facture — marquez le RDV comme Complété pour en créer une.
                        </p>
                      )}
                    </div>

                    {/* Avis Google */}
                    <div>
                      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Avis Google</p>
                      <div className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-2">
                        <p className="text-xs text-text-secondary flex items-center gap-1.5">
                          <Star className={`h-3.5 w-3.5 ${rdv.avisEnvoye ? "text-amber-500" : "text-text-tertiary"}`} />
                          {rdv.avisEnvoye ? "Lien envoyé" : "Pas encore envoyé"}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={envoyerAvisMutation.isPending}
                          onClick={() => envoyerAvisMutation.mutate({ patientId: rdv.patient.id, rendezvousId: rdv.id })}
                        >
                          {envoyerAvisMutation.isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Star className="h-3.5 w-3.5" />}
                          {rdv.avisEnvoye ? "Renvoyer" : "Envoyer"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le RDV de {rdv.patient.prenom} {rdv.patient.nom} du{" "}
              {format(new Date(rdv.dateHeure), "d MMMM yyyy à HH:mm", { locale: fr })} sera supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => supprimerMutation.mutate({ id: rdv.id })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rdvFacture && (
        <Dialog open={showFactureDialog} onOpenChange={setShowFactureDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Envoyer la facture {rdvFacture.numero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-text-secondary">
                Total: <span className="font-semibold text-text-primary">{Number(rdvFacture.total).toFixed(2)} $</span>
              </p>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={factureCanal} onValueChange={(v) => setFactureCanal(v as typeof factureCanal)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Courriel</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="LES_DEUX">Courriel + SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFactureDialog(false)}>Annuler</Button>
              <Button
                onClick={() => envoyerFactureMutation.mutate({ id: rdvFacture.id, canal: factureCanal })}
                disabled={envoyerFactureMutation.isPending}
              >
                {envoyerFactureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Envoyer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
