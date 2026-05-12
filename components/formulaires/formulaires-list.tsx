"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Plus, FileText, CheckCircle, Clock, Pencil, Trash2, Wand2, Eraser } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

export function FormulairesList() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: formulaires, isLoading } = trpc.formulaire.liste.useQuery()

  const [cleaningUp, setCleaningUp] = useState(false)
  const nettoyerDoublons = async () => {
    setCleaningUp(true)
    try {
      const res = await fetch("/api/admin/cleanup-formulaires", { method: "POST" })
      const data = await res.json() as { deleted?: number; error?: string }
      if (data.error) { toast.error(data.error); return }
      if (data.deleted === 0) toast.info("Aucun doublon trouvé.")
      else toast.success(`${data.deleted} doublon${data.deleted !== 1 ? "s" : ""} supprimé${data.deleted !== 1 ? "s" : ""}.`)
      utils.formulaire.liste.invalidate()
    } catch {
      toast.error("Erreur lors du nettoyage.")
    } finally {
      setCleaningUp(false)
    }
  }

  const seedMutation = trpc.formulaire.seedPrebuilts.useMutation({
    onSuccess: (data) => {
      utils.formulaire.liste.invalidate()
      if (data.created > 0) toast.success(`${data.created} formulaire${data.created > 1 ? "s" : ""} pré-construit${data.created > 1 ? "s" : ""} ajouté${data.created > 1 ? "s" : ""}.`)
      else toast.info("Des formulaires existent déjà.")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = trpc.formulaire.supprimer.useMutation({
    onSuccess: () => {
      utils.formulaire.liste.invalidate()
      toast.success("Formulaire supprimé.")
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = trpc.formulaire.update.useMutation({
    onSuccess: () => utils.formulaire.liste.invalidate(),
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button onClick={() => router.push("/formulaires/nouveau")}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau formulaire
        </Button>
        <Button
          variant="outline"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Importer les modèles pré-construits
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-tertiary ml-auto"
          onClick={nettoyerDoublons}
          disabled={cleaningUp}
          title="Supprimer les réponses en attente en doublon"
        >
          <Eraser className="h-3.5 w-3.5 mr-1.5" />
          {cleaningUp ? "Nettoyage…" : "Nettoyer les doublons"}
        </Button>
      </div>

      {/* Empty state */}
      {formulaires?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 rounded-card border-2 border-dashed border-border">
          <FileText className="h-10 w-10 text-text-tertiary" />
          <div>
            <p className="font-medium">Aucun formulaire</p>
            <p className="text-sm text-text-secondary">Créez votre premier formulaire ou importez les modèles pré-construits.</p>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {formulaires?.map((f) => {
          const questions = f.questions as { id: string; type: string }[]
          const completions = f._count.reponses
          return (
            <div
              key={f.id}
              className="group rounded-card border border-border bg-bg-primary p-5 hover:border-brand-primary/40 transition-all cursor-pointer"
              onClick={() => router.push(`/formulaires/${f.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{f.nom}</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Créé le {format(new Date(f.createdAt), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Badge className={f.actif ? "bg-green-100 text-green-700 border-0 text-xs" : "bg-slate-100 text-slate-500 border-0 text-xs"}>
                    {f.actif ? "Actif" : "Inactif"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-bg-secondary transition-all">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/formulaires/${f.id}`)}>
                        <Pencil className="h-4 w-4 mr-2" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: f.id, actif: !f.actif })}>
                        {f.actif ? "Désactiver" : "Activer"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => deleteMutation.mutate({ id: f.id })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {questions.length} question{questions.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {completions} réponse{completions !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
