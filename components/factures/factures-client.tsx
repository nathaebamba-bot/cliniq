"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { Send, CheckCircle, FileText, Loader2, MoreHorizontal, Pencil, Trash2, BookOpen, Download } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { StatutFacture } from "@prisma/client"
import { cn } from "@/lib/utils"

const STATUT_CONFIG: Record<StatutFacture, { label: string; className: string }> = {
  BROUILLON: { label: "Brouillon",  className: "bg-slate-100 text-slate-700" },
  ENVOYE:    { label: "Envoyée",    className: "bg-blue-100 text-blue-700" },
  PAYE:      { label: "Payée",      className: "bg-green-100 text-green-700" },
  ANNULE:    { label: "Annulée",    className: "bg-red-100 text-red-700" },
}

type Ligne = { description: string; montant: number }

interface FactureRow {
  id: string
  numero: string
  statut: StatutFacture
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  total: any
  createdAt: Date
  destCourriel: string | null
  patient: { prenom: string; nom: string; courriel: string | null; telephone: string }
  rendezvous: { dateHeure: Date; typeRdv: string | null } | null
  lignes: unknown
}

export function FacturesClient() {
  const utils = trpc.useUtils()
  const [page, setPage] = useState(1)
  const [filterStatut, setFilterStatut] = useState<StatutFacture | "TOUS">("TOUS")
  const [editFacture, setEditFacture] = useState<FactureRow | null>(null)
  const [envoyerFacture, setEnvoyerFacture] = useState<FactureRow | null>(null)
  const [deleteFacture, setDeleteFacture] = useState<FactureRow | null>(null)

  // Edit state
  const [editLignes, setEditLignes] = useState<Ligne[]>([])
  const [editTaxes, setEditTaxes] = useState(0)
  const [editCourriel, setEditCourriel] = useState("")
  const [sendCanal, setSendCanal] = useState<"EMAIL" | "SMS" | "LES_DEUX">("EMAIL")

  const { data: catalogue } = trpc.catalogueService.liste.useQuery({ actifSeulement: true })

  const { data, isLoading } = trpc.facture.liste.useQuery({
    page,
    perPage: 25,
    statut: filterStatut === "TOUS" ? undefined : filterStatut,
  })

  const modifierMutation = trpc.facture.modifier.useMutation({
    onSuccess: () => {
      utils.facture.liste.invalidate()
      toast.success("Facture mise à jour.")
      setEditFacture(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const envoyerMutation = trpc.facture.envoyer.useMutation({
    onSuccess: (res) => {
      utils.facture.liste.invalidate()
      if (res.ok) toast.success("Facture envoyée.")
      else toast.error(`Erreur: ${res.errors.join(", ")}`)
      setEnvoyerFacture(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const marquerPayeMutation = trpc.facture.marquerPaye.useMutation({
    onSuccess: () => { utils.facture.liste.invalidate(); toast.success("Facture marquée payée.") },
    onError: (e) => toast.error(e.message),
  })

  const supprimerMutation = trpc.facture.supprimer.useMutation({
    onSuccess: () => { utils.facture.liste.invalidate(); toast.success("Facture supprimée."); setDeleteFacture(null) },
    onError: (e) => toast.error(e.message),
  })

  const openEdit = (f: FactureRow) => {
    setEditLignes((f.lignes as Ligne[]) ?? [{ description: "", montant: 0 }])
    setEditTaxes(0)
    setEditCourriel(f.destCourriel ?? f.patient.courriel ?? "")
    setEditFacture(f)
  }

  const openEnvoyer = (f: FactureRow) => {
    setSendCanal("EMAIL")
    setEnvoyerFacture(f)
  }

  const handleSaveEdit = () => {
    if (!editFacture) return
    modifierMutation.mutate({
      id: editFacture.id,
      lignes: editLignes.filter((l) => l.description.trim()),
      taxes: editTaxes,
      destCourriel: editCourriel || undefined,
    })
  }

  const sousTotal = editLignes.reduce((s, l) => s + (l.montant || 0), 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v as StatutFacture | "TOUS"); setPage(1) }}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les statuts</SelectItem>
            <SelectItem value="BROUILLON">Brouillon</SelectItem>
            <SelectItem value="ENVOYE">Envoyée</SelectItem>
            <SelectItem value="PAYE">Payée</SelectItem>
            <SelectItem value="ANNULE">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-text-secondary ml-auto">
          {data ? `${data.total} facture${data.total !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Numéro</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Service</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Date</th>
              <th className="text-right px-4 py-3 font-medium text-text-secondary">Total</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : data?.factures.length === 0
              ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Aucune facture
                    </td>
                  </tr>
                )
              : data?.factures.map((f) => {
                  const cfg = STATUT_CONFIG[f.statut]
                  return (
                    <tr key={f.id} className="hover:bg-bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{f.numero}</td>
                      <td className="px-4 py-3 font-medium">
                        {f.patient.prenom} {f.patient.nom}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {f.rendezvous?.typeRdv ?? (f.lignes as Ligne[])?.[0]?.description ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {format(new Date(f.createdAt), "d MMM yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {Number(f.total).toFixed(2)} $
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn("border-0 text-xs", cfg.className)}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/api/pdf/facture/${f.id}`, "_blank")}>
                              <Download className="h-3.5 w-3.5 mr-2" /> Télécharger PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(f as unknown as FactureRow)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier montant
                            </DropdownMenuItem>
                            {f.statut !== "PAYE" && f.statut !== "ANNULE" && (
                              <DropdownMenuItem onClick={() => openEnvoyer(f as unknown as FactureRow)}>
                                <Send className="h-3.5 w-3.5 mr-2" /> Envoyer
                              </DropdownMenuItem>
                            )}
                            {f.statut !== "PAYE" && (
                              <DropdownMenuItem onClick={() => marquerPayeMutation.mutate({ id: f.id })}>
                                <CheckCircle className="h-3.5 w-3.5 mr-2" /> Marquer payée
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteFacture(f as unknown as FactureRow)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-text-secondary self-center">{page} / {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editFacture} onOpenChange={(o) => { if (!o) setEditFacture(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la facture {editFacture?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Lignes de service</Label>
              <div className="space-y-2">
                {editLignes.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Description du service"
                      value={l.description}
                      onChange={(e) => {
                        const n = [...editLignes]; n[i] = { ...n[i], description: e.target.value }; setEditLignes(n)
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={l.montant || ""}
                      onChange={(e) => {
                        const n = [...editLignes]; n[i] = { ...n[i], montant: parseFloat(e.target.value) || 0 }; setEditLignes(n)
                      }}
                      className="w-28"
                    />
                    <Button
                      variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-500"
                      onClick={() => setEditLignes(editLignes.filter((_, j) => j !== i))}
                    >×</Button>
                  </div>
                ))}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setEditLignes([...editLignes, { description: "", montant: 0 }])}
                  >
                    + Ligne manuelle
                  </Button>
                  {catalogue && catalogue.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-border px-3 h-8 text-sm hover:bg-bg-secondary transition-colors">
                        <BookOpen className="h-3.5 w-3.5" /> Du catalogue
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto w-72">
                        {catalogue.map((s: { id: string; nom: string; prix: unknown }) => (
                          <DropdownMenuItem
                            key={s.id}
                            onClick={() => setEditLignes([...editLignes, { description: s.nom, montant: Number(s.prix) }])}
                          >
                            <span className="flex-1">{s.nom}</span>
                            <span className="ml-2 text-text-tertiary tabular-nums">{Number(s.prix).toFixed(2)} $</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Taxes ($)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={editTaxes || ""}
                  onChange={(e) => setEditTaxes(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Total estimé</Label>
                <div className="h-9 flex items-center px-3 rounded-md border border-border bg-bg-secondary font-semibold">
                  {(sousTotal + editTaxes).toFixed(2)} $
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Courriel destinataire (patient ou assurance)</Label>
              <Input
                type="email"
                placeholder="email@exemple.com"
                value={editCourriel}
                onChange={(e) => setEditCourriel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFacture(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={modifierMutation.isPending}>
              {modifierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={!!envoyerFacture} onOpenChange={(o) => { if (!o) setEnvoyerFacture(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Envoyer la facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-text-secondary mb-1">
                Destinataire: <span className="font-medium text-text-primary">
                  {envoyerFacture?.destCourriel ?? envoyerFacture?.patient.courriel ?? envoyerFacture?.patient.telephone}
                </span>
              </p>
              <p className="text-sm text-text-secondary">
                Total: <span className="font-semibold text-text-primary">{Number(envoyerFacture?.total ?? 0).toFixed(2)} $</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Canal d&apos;envoi</Label>
              <Select value={sendCanal} onValueChange={(v) => setSendCanal(v as typeof sendCanal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Courriel seulement</SelectItem>
                  <SelectItem value="SMS">SMS seulement</SelectItem>
                  <SelectItem value="LES_DEUX">Courriel + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvoyerFacture(null)}>Annuler</Button>
            <Button
              onClick={() => envoyerFacture && envoyerMutation.mutate({ id: envoyerFacture.id, canal: sendCanal })}
              disabled={envoyerMutation.isPending}
            >
              {envoyerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteFacture} onOpenChange={(o) => { if (!o) setDeleteFacture(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture {deleteFacture?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteFacture && supprimerMutation.mutate({ id: deleteFacture.id })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
