"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v3"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { trpc } from "@/trpc/client"
import type { Patient } from "@prisma/client"
import { Shield } from "lucide-react"

const schema = z.object({
  prenom: z.string().min(1, "Requis"),
  nom: z.string().min(1, "Requis"),
  telephone: z.string().min(1, "Requis"),
  courriel: z.string().email("Courriel invalide").optional().or(z.literal("")),
  dateNaissance: z.string().optional(),
  sexe: z.enum(["M", "F", "AUTRE", "NON_PRECISE"]).optional(),
  langue: z.enum(["FR", "EN"]),
  consentementSMS: z.boolean(),
  consentementCourriel: z.boolean(),
  alertes: z.string().optional(),
  notes: z.string().optional(),
  assuranceStatut: z.enum(["OUI", "NON", "INCONNU"]).optional().nullable(),
  assuranceNom: z.string().optional().nullable(),
  assuranceNumPolice: z.string().optional().nullable(),
  assuranceNumMembre: z.string().optional().nullable(),
  assuranceConsente: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  patient?: Patient
  onSuccess: () => void
  onCancel: () => void
}

export function PatientForm({ patient, onSuccess, onCancel }: Props) {
  const utils = trpc.useUtils()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: patient
      ? {
          prenom: patient.prenom,
          nom: patient.nom,
          telephone: patient.telephone,
          courriel: patient.courriel ?? "",
          dateNaissance: patient.dateNaissance
            ? new Date(patient.dateNaissance).toISOString().split("T")[0]
            : "",
          sexe: patient.sexe ?? undefined,
          langue: patient.langue,
          consentementSMS: patient.consentementSMS,
          consentementCourriel: patient.consentementCourriel,
          alertes: patient.alertes ?? "",
          notes: patient.notes ?? "",
          assuranceStatut: (patient as any).assuranceStatut ?? null,
          assuranceNom: (patient as any).assuranceNom ?? "",
          assuranceNumPolice: (patient as any).assuranceNumPolice ?? "",
          assuranceNumMembre: (patient as any).assuranceNumMembre ?? "",
          assuranceConsente: (patient as any).assuranceConsente ?? false,
        }
      : {
          langue: "FR" as const,
          consentementSMS: false,
          consentementCourriel: false,
          assuranceStatut: null,
          assuranceConsente: false,
        },
  })

  const createMutation = trpc.patient.create.useMutation({
    onSuccess: () => {
      utils.patient.liste.invalidate()
      toast.success("Patient créé avec succès.")
      onSuccess()
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMutation = trpc.patient.update.useMutation({
    onSuccess: () => {
      utils.patient.liste.invalidate()
      utils.patient.getById.invalidate()
      toast.success("Patient mis à jour.")
      onSuccess()
    },
    onError: (e) => toast.error(e.message),
  })

  const onSubmit = (data: FormValues) => {
    const payload = {
      ...data,
      courriel: data.courriel || null,
      sexe: data.sexe ?? null,
      dateNaissance: data.dateNaissance || null,
      alertes: data.alertes || null,
      notes: data.notes || null,
      assuranceStatut: data.assuranceStatut ?? null,
      assuranceNom: data.assuranceNom || null,
      assuranceNumPolice: data.assuranceNumPolice || null,
      assuranceNumMembre: data.assuranceNumMembre || null,
      assuranceConsente: data.assuranceConsente ?? false,
    }
    if (patient) {
      updateMutation.mutate({ id: patient.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isLoading = isSubmitting || createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="prenom">Prénom *</Label>
          <Input id="prenom" {...register("prenom")} />
          {errors.prenom && <p className="text-xs text-red-500">{errors.prenom.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" {...register("nom")} />
          {errors.nom && <p className="text-xs text-red-500">{errors.nom.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="telephone">Téléphone *</Label>
          <Input id="telephone" placeholder="+15141234567" {...register("telephone")} />
          {errors.telephone && <p className="text-xs text-red-500">{errors.telephone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="courriel">Courriel</Label>
          <Input id="courriel" type="email" {...register("courriel")} />
          {errors.courriel && <p className="text-xs text-red-500">{errors.courriel.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="dateNaissance">Date de naissance</Label>
          <Input id="dateNaissance" type="date" {...register("dateNaissance")} />
        </div>
        <div className="space-y-1">
          <Label>Sexe</Label>
          <Select
            value={watch("sexe") ?? ""}
            onValueChange={(v) => setValue("sexe", v as "M" | "F" | "AUTRE" | "NON_PRECISE")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Homme</SelectItem>
              <SelectItem value="F">Femme</SelectItem>
              <SelectItem value="AUTRE">Autre</SelectItem>
              <SelectItem value="NON_PRECISE">Non précisé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Langue</Label>
          <Select
            value={watch("langue")}
            onValueChange={(v) => setValue("langue", v as "FR" | "EN")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FR">Français</SelectItem>
              <SelectItem value="EN">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Consentements</p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={watch("consentementSMS")}
              onCheckedChange={(v) => setValue("consentementSMS", !!v)}
            />
            SMS
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={watch("consentementCourriel")}
              onCheckedChange={(v) => setValue("consentementCourriel", !!v)}
            />
            Courriel
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="alertes">Alertes médicales</Label>
        <Input id="alertes" placeholder="Allergies, conditions importantes…" {...register("alertes")} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes internes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      {/* Assurance */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-text-tertiary" />
          <p className="text-sm font-medium">Assurance privée</p>
        </div>
        <div className="space-y-1">
          <Label>Statut</Label>
          <Select
            value={watch("assuranceStatut") ?? ""}
            onValueChange={(v) =>
              setValue("assuranceStatut", v ? (v as "OUI" | "NON" | "INCONNU") : null)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUI">Oui — assuré(e)</SelectItem>
              <SelectItem value="NON">Non — sans assurance</SelectItem>
              <SelectItem value="INCONNU">Inconnu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {watch("assuranceStatut") === "OUI" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="assuranceNom">Nom de l'assureur</Label>
              <Input id="assuranceNom" placeholder="Ex: Sun Life, Desjardins, Croix Bleue…" {...register("assuranceNom")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="assuranceNumPolice">N° de police</Label>
                <Input id="assuranceNumPolice" placeholder="Ex: 12345678" {...register("assuranceNumPolice")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assuranceNumMembre">N° de membre</Label>
                <Input id="assuranceNumMembre" placeholder="Ex: 001" {...register("assuranceNumMembre")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={watch("assuranceConsente") ?? false}
                onCheckedChange={(v) => setValue("assuranceConsente", !!v)}
              />
              Consentement obtenu pour facturation à l'assureur
            </label>
          </>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Sauvegarde…" : patient ? "Mettre à jour" : "Créer le patient"}
        </Button>
      </div>
    </form>
  )
}
