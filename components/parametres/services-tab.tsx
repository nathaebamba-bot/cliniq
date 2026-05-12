"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Service = {
  id: string
  nom: string
  description: string | null
  prix: unknown
  codeFacturation: string | null
  typeRdv: string | null
  actif: boolean
}

const emptyForm = { nom: "", description: "", prix: "", codeFacturation: "", typeRdv: "" }

export function ServicesTab() {
  const utils = trpc.useUtils()
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: services, isLoading } = trpc.catalogueService.liste.useQuery({ actifSeulement: false })

  const creerMutation = trpc.catalogueService.creer.useMutation({
    onSuccess: () => { utils.catalogueService.liste.invalidate(); toast.success("Service ajouté."); setDialog(null) },
    onError: (e) => toast.error(e.message),
  })

  const modifierMutation = trpc.catalogueService.modifier.useMutation({
    onSuccess: () => { utils.catalogueService.liste.invalidate(); toast.success("Service mis à jour."); setDialog(null) },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = trpc.catalogueService.toggleActif.useMutation({
    onSuccess: () => utils.catalogueService.liste.invalidate(),
    onError: (e) => toast.error(e.message),
  })

  const supprimerMutation = trpc.catalogueService.supprimer.useMutation({
    onSuccess: () => { utils.catalogueService.liste.invalidate(); toast.success("Service supprimé."); setDeleteTarget(null) },
    onError: (e) => toast.error(e.message),
  })

  function openCreate() {
    setForm(emptyForm)
    setEditTarget(null)
    setDialog("create")
  }

  function openEdit(s: Service) {
    setForm({
      nom: s.nom,
      description: s.description ?? "",
      prix: String(Number(s.prix)),
      codeFacturation: s.codeFacturation ?? "",
      typeRdv: s.typeRdv ?? "",
    })
    setEditTarget(s)
    setDialog("edit")
  }

  function handleSubmit() {
    const prix = parseFloat(form.prix)
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire."); return }
    if (isNaN(prix) || prix < 0) { toast.error("Prix invalide."); return }

    const payload = {
      nom: form.nom.trim(),
      description: form.description.trim() || undefined,
      prix,
      codeFacturation: form.codeFacturation.trim() || undefined,
      typeRdv: form.typeRdv.trim() || undefined,
    }

    if (dialog === "create") {
      creerMutation.mutate(payload)
    } else if (editTarget) {
      modifierMutation.mutate({ id: editTarget.id, ...payload })
    }
  }

  const isPending = creerMutation.isPending || modifierMutation.isPending

  // Group by typeRdv
  const groups = new Map<string, Service[]>()
  for (const s of services ?? []) {
    const key = s.typeRdv ?? "Général"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-brand-primary" />
              Catalogue de services & tarifs
            </CardTitle>
            <p className="text-sm text-text-secondary mt-1">
              Définissez vos services avec leurs prix pour les ajouter rapidement aux factures.
            </p>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Ajouter un service
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : services?.length === 0 ? (
            <div className="text-center py-10 text-text-tertiary">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun service configuré.</p>
              <p className="text-xs mt-1">Ajoutez vos services pour les retrouver facilement dans vos factures.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groups.entries()).map(([groupe, items]) => (
                <div key={groupe}>
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">{groupe}</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-bg-secondary">
                        <tr>
                          <th className="text-left p-3 font-medium text-text-secondary">Service</th>
                          <th className="text-left p-3 font-medium text-text-secondary">Code facturation</th>
                          <th className="text-right p-3 font-medium text-text-secondary">Prix</th>
                          <th className="text-center p-3 font-medium text-text-secondary w-24">Actif</th>
                          <th className="w-20" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((s) => (
                          <tr key={s.id} className={`border-t border-border ${!s.actif ? "opacity-50" : ""}`}>
                            <td className="p-3">
                              <p className="font-medium">{s.nom}</p>
                              {s.description && <p className="text-xs text-text-tertiary">{s.description}</p>}
                            </td>
                            <td className="p-3 font-mono text-xs text-text-secondary">
                              {s.codeFacturation ?? "—"}
                            </td>
                            <td className="p-3 text-right font-semibold tabular-nums">
                              {Number(s.prix).toFixed(2)} $
                            </td>
                            <td className="p-3 text-center">
                              <button onClick={() => toggleMutation.mutate({ id: s.id })} className="text-text-tertiary hover:text-brand-primary transition-colors">
                                {s.actif
                                  ? <ToggleRight className="h-5 w-5 text-brand-primary" />
                                  : <ToggleLeft className="h-5 w-5" />}
                              </button>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded hover:bg-red-50 text-text-tertiary hover:text-red-600 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) setDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Ajouter un service" : "Modifier le service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="s-nom">Nom du service *</Label>
              <Input id="s-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Nettoyage dentaire" />
            </div>
            <div>
              <Label htmlFor="s-desc">Description (optionnel)</Label>
              <Input id="s-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ex: Prophylaxie complète + examen" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="s-prix">Prix ($) *</Label>
                <Input id="s-prix" type="number" min="0" step="0.01" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="s-code">Code facturation</Label>
                <Input id="s-code" value={form.codeFacturation} onChange={(e) => setForm({ ...form, codeFacturation: e.target.value })} placeholder="ex: 11110" />
              </div>
            </div>
            <div>
              <Label htmlFor="s-type">Type de RDV associé (optionnel)</Label>
              <Input id="s-type" value={form.typeRdv} onChange={(e) => setForm({ ...form, typeRdv: e.target.value })} placeholder="ex: Nettoyage, Consultation, Massage…" />
              <p className="text-xs text-text-tertiary mt-1">Permet de pré-remplir la facture quand un RDV de ce type est complété.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Enregistrement…" : dialog === "create" ? "Ajouter" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleteTarget?.nom} »?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Les factures existantes ne seront pas affectées.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && supprimerMutation.mutate({ id: deleteTarget.id })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
