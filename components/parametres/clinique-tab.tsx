"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v3"
import { Plus, Trash2, Pencil } from "lucide-react"
import { trpc } from "@/trpc/client"
import { TypeClinique } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const orgSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  type: z.nativeEnum(TypeClinique),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  codePostal: z.string().optional(),
  telephone: z.string().optional(),
  courriel: z.string().email("Courriel invalide").optional().or(z.literal("")),
  siteWeb: z.string().url("URL invalide").optional().or(z.literal("")),
  couleurPrimaire: z.string().optional(),
})

const praticienSchema = z.object({
  prenom: z.string().min(1, "Prénom requis"),
  nom: z.string().min(1, "Nom requis"),
  titre: z.string().optional(),
  specialite: z.string().optional(),
  courriel: z.string().email("Courriel invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  couleur: z.string().optional(),
})

type OrgForm = z.infer<typeof orgSchema>
type PraticienForm = z.infer<typeof praticienSchema>

const TYPE_LABELS: Record<TypeClinique, string> = {
  DENTAIRE: "Dentaire",
  PHYSIOTHERAPIE: "Physiothérapie",
  PSYCHOLOGIE: "Psychologie",
  MASSOTHERAPIE: "Massothérapie",
  OPTOMETRIE: "Optométrie",
  MEDECINE_GENERALE: "Médecine générale",
  AUTRE: "Autre",
}

export function CliniquTab() {
  const t = useTranslations("parametres")
  const utils = trpc.useUtils()
  const { data: org, isPending } = trpc.organisation.get.useQuery()
  const upsert = trpc.organisation.upsert.useMutation({
    onSuccess: () => { toast.success(t("sauvegardeReussie")); utils.organisation.get.invalidate() },
    onError: (e) => toast.error(e.message),
  })

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    values: org ? {
      nom: org.nom,
      type: org.type,
      adresse: org.adresse ?? "",
      ville: org.ville ?? "",
      codePostal: org.codePostal ?? "",
      telephone: org.telephone ?? "",
      courriel: org.courriel ?? "",
      siteWeb: org.siteWeb ?? "",
      couleurPrimaire: org.couleurPrimaire,
    } : undefined,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPraticienId, setEditingPraticienId] = useState<string | null>(null)

  const praticienForm = useForm<PraticienForm>({ resolver: zodResolver(praticienSchema) })

  const createPraticien = trpc.praticien.create.useMutation({
    onSuccess: () => { toast.success("Praticien ajouté."); utils.organisation.get.invalidate(); setDialogOpen(false); praticienForm.reset() },
    onError: (e) => toast.error(e.message),
  })
  const updatePraticien = trpc.praticien.update.useMutation({
    onSuccess: () => { toast.success("Praticien mis à jour."); utils.organisation.get.invalidate(); setDialogOpen(false); praticienForm.reset() },
    onError: (e) => toast.error(e.message),
  })
  const supprimerPraticien = trpc.praticien.supprimer.useMutation({
    onSuccess: () => { toast.success("Praticien archivé."); utils.organisation.get.invalidate() },
    onError: (e) => toast.error(e.message),
  })

  if (isPending) return <Skeleton className="h-96 w-full" />

  function onOuvrir(praticien?: NonNullable<typeof org>["praticiens"][number]) {
    if (praticien) {
      setEditingPraticienId(praticien.id)
      praticienForm.reset({
        prenom: praticien.prenom,
        nom: praticien.nom,
        titre: praticien.titre ?? "",
        specialite: praticien.specialite ?? "",
        courriel: praticien.courriel ?? "",
        telephone: praticien.telephone ?? "",
        couleur: praticien.couleur ?? "",
      })
    } else {
      setEditingPraticienId(null)
      praticienForm.reset()
    }
    setDialogOpen(true)
  }

  function onSoumettreP(data: PraticienForm) {
    if (editingPraticienId) {
      updatePraticien.mutate({ id: editingPraticienId, ...data })
    } else {
      createPraticien.mutate(data)
    }
  }

  return (
    <div className="space-y-6">
      {/* Informations de la clinique */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Informations de la clinique</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => upsert.mutate(d))} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nom">{t("nomClinique")} *</Label>
              <Input id="nom" {...register("nom")} />
              {errors.nom && <p className="text-xs text-brand-danger">{errors.nom.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>{t("typeClinique")} *</Label>
              <Select value={watch("type")} onValueChange={(v) => setValue("type", v as TypeClinique)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TypeClinique) as TypeClinique[]).map((k) => (
                    <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adresse">{t("adresse")}</Label>
              <Input id="adresse" {...register("adresse")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ville">{t("ville")}</Label>
              <Input id="ville" {...register("ville")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="codePostal">{t("codePostal")}</Label>
              <Input id="codePostal" {...register("codePostal")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telephone">{t("telephone")}</Label>
              <Input id="telephone" type="tel" {...register("telephone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courriel">{t("courriel")}</Label>
              <Input id="courriel" type="email" {...register("courriel")} />
              {errors.courriel && <p className="text-xs text-brand-danger">{errors.courriel.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteWeb">{t("siteWeb")}</Label>
              <Input id="siteWeb" type="url" {...register("siteWeb")} />
              {errors.siteWeb && <p className="text-xs text-brand-danger">{errors.siteWeb.message}</p>}
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Sauvegarde…" : t("sauvegarder")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Praticiens */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">{t("praticiens")}</CardTitle>
          <Button size="sm" onClick={() => onOuvrir()}>
            <Plus className="mr-1 h-4 w-4" />
            {t("ajouterPraticien")}
          </Button>
        </CardHeader>
        <CardContent>
          {!org?.praticiens?.length ? (
            <p className="text-sm text-text-tertiary text-center py-6">Aucun praticien. Ajoutez-en un pour commencer.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {org.praticiens.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {p.couleur && (
                      <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: p.couleur }} />
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {p.titre ? `${p.titre} ` : ""}{p.prenom} {p.nom}
                      </p>
                      {p.specialite && <p className="text-xs text-text-tertiary">{p.specialite}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{p.actif ? "Actif" : "Inactif"}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => onOuvrir(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-brand-danger hover:text-brand-danger" onClick={() => supprimerPraticien.mutate({ id: p.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Dialog praticien */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPraticienId ? "Modifier le praticien" : t("ajouterPraticien")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={praticienForm.handleSubmit(onSoumettreP)} className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("prenom")} *</Label>
              <Input {...praticienForm.register("prenom")} />
              {praticienForm.formState.errors.prenom && <p className="text-xs text-brand-danger">{praticienForm.formState.errors.prenom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("nom")} *</Label>
              <Input {...praticienForm.register("nom")} />
              {praticienForm.formState.errors.nom && <p className="text-xs text-brand-danger">{praticienForm.formState.errors.nom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("titre")}</Label>
              <Input {...praticienForm.register("titre")} placeholder="Dr, Dre, M., Mme…" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("specialite")}</Label>
              <Input {...praticienForm.register("specialite")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("courriel")}</Label>
              <Input type="email" {...praticienForm.register("courriel")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("telephone")}</Label>
              <Input type="tel" {...praticienForm.register("telephone")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Couleur (calendrier)</Label>
              <Input type="color" {...praticienForm.register("couleur")} className="h-10 cursor-pointer px-2" />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createPraticien.isPending || updatePraticien.isPending}>
                {(createPraticien.isPending || updatePraticien.isPending) ? "Sauvegarde…" : t("sauvegarder")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
