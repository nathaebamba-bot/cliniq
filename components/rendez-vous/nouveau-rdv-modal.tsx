"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v3"
import { toast } from "sonner"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const schema = z.object({
  patientId: z.string().min(1, "Requis"),
  praticienId: z.string().min(1, "Requis"),
  date: z.string().min(1, "Requis"),
  heure: z.string().min(1, "Requis"),
  dureeMinutes: z.number().int().min(15).max(480),
  typeRdv: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate?: Date
  defaultPatient?: { id: string; prenom: string; nom: string }
  onSuccess?: () => void
}

export function NouveauRdvModal({ open, onOpenChange, defaultDate, defaultPatient, onSuccess }: Props) {
  const utils = trpc.useUtils()
  const [patientSearch, setPatientSearch] = useState(
    defaultPatient ? `${defaultPatient.prenom} ${defaultPatient.nom}` : ""
  )
  const [showIA, setShowIA] = useState(false)
  const [demandeIA, setDemandeIA] = useState("")

  const { data: patientsData } = trpc.patient.liste.useQuery(
    { recherche: patientSearch, actif: true, perPage: 10 },
    { enabled: open && !defaultPatient }
  )

  const { data: org } = trpc.organisation.get.useQuery(undefined, { enabled: open })
  const praticiens = org?.praticiens ?? []

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: defaultPatient?.id ?? "",
      date: defaultDate ? defaultDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      heure: "09:00",
      dureeMinutes: 60,
    },
  })

  const createMutation = trpc.rendezVous.create.useMutation({
    onSuccess: () => {
      utils.rendezVous.liste.invalidate()
      toast.success("Rendez-vous créé.")
      reset()
      setShowIA(false)
      setDemandeIA("")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const suggestionsMutation = trpc.rendezVous.suggestionsIA.useMutation({
    onError: (e) => toast.error(`Erreur IA : ${e.message}`),
  })

  const onSubmit = (data: FormValues) => {
    const dateHeure = new Date(`${data.date}T${data.heure}:00`)
    createMutation.mutate({
      patientId: data.patientId,
      praticienId: data.praticienId,
      dateHeure,
      dureeMinutes: data.dureeMinutes,
      typeRdv: data.typeRdv || undefined,
      notes: data.notes || undefined,
    })
  }

  const appliquerSuggestion = (s: NonNullable<typeof suggestionsMutation.data>[number]) => {
    const d = new Date(s.dateHeure)
    setValue("praticienId", s.praticienId)
    setValue("date", d.toISOString().split("T")[0])
    setValue("heure", `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)
    setValue("dureeMinutes", s.dureeMinutes)
    setValue("typeRdv", s.typeRdv)
    setShowIA(false)
    toast.success("Créneau appliqué — complétez le patient et confirmez.")
  }

  const patients = patientsData?.patients ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setShowIA(false); setDemandeIA("") } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
        </DialogHeader>

        {/* ── IA Panel ── */}
        <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/5">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-brand-primary"
            onClick={() => setShowIA((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Planifier avec l'IA
            </span>
            {showIA ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showIA && (
            <div className="px-3 pb-3 space-y-3 border-t border-brand-primary/10 pt-3">
              <div className="space-y-1">
                <Label className="text-xs text-text-secondary">
                  Décrivez le besoin en langage naturel
                </Label>
                <Textarea
                  rows={2}
                  placeholder="Ex : Physio pour douleur genou, semaine prochaine matin si possible, 60 min"
                  value={demandeIA}
                  onChange={(e) => setDemandeIA(e.target.value)}
                  className="text-sm resize-none"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={!demandeIA.trim() || suggestionsMutation.isPending}
                onClick={() => suggestionsMutation.mutate({ demande: demandeIA })}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {suggestionsMutation.isPending ? "Analyse en cours…" : "Suggérer des créneaux"}
              </Button>

              {/* Suggestions */}
              {suggestionsMutation.data && suggestionsMutation.data.length > 0 && (
                <div className="space-y-2">
                  {suggestionsMutation.data.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-bg-primary p-3 hover:border-brand-primary/40 transition-colors cursor-pointer group"
                      onClick={() => appliquerSuggestion(s)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary">
                            {format(new Date(s.dateHeure), "EEEE d MMMM à HH:mm", { locale: fr })}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {s.praticienNom} · {s.dureeMinutes} min · {s.typeRdv}
                          </p>
                          <p className="text-xs text-text-tertiary mt-1 italic">{s.explication}</p>
                        </div>
                        <div className="shrink-0 h-6 w-6 rounded-full border border-brand-primary/30 flex items-center justify-center group-hover:bg-brand-primary group-hover:border-brand-primary transition-colors">
                          <Check className="h-3.5 w-3.5 text-brand-primary group-hover:text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Patient */}
          <div className="space-y-1">
            <Label>Patient *</Label>
            <Input
              placeholder="Rechercher un patient…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
            {patients.length > 0 && patientSearch && (
              <div className="border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors"
                    onClick={() => {
                      setValue("patientId", p.id)
                      setPatientSearch(`${p.prenom} ${p.nom}`)
                    }}
                  >
                    <span className="font-medium">{p.prenom} {p.nom}</span>
                    <span className="ml-2 text-text-tertiary font-mono text-xs">{p.telephone}</span>
                  </button>
                ))}
              </div>
            )}
            {errors.patientId && <p className="text-xs text-red-500">Sélectionnez un patient</p>}
            <input type="hidden" {...register("patientId")} />
          </div>

          {/* Praticien */}
          <div className="space-y-1">
            <Label>Praticien *</Label>
            <Select
              value={watch("praticienId") ?? ""}
              onValueChange={(v) => setValue("praticienId", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un praticien…" />
              </SelectTrigger>
              <SelectContent>
                {praticiens.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prenom} {p.nom}
                    {p.titre && <span className="text-text-tertiary ml-1">— {p.titre}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.praticienId && <p className="text-xs text-red-500">Sélectionnez un praticien</p>}
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" {...register("date")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="heure">Heure *</Label>
              <Input id="heure" type="time" step="900" {...register("heure")} />
            </div>
          </div>

          {/* Durée + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Durée (minutes)</Label>
              <Select
                value={String(watch("dureeMinutes"))}
                onValueChange={(v) => setValue("dureeMinutes", parseInt(v ?? "60"))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 75, 90, 120, 180, 240].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="typeRdv">Type de rendez-vous</Label>
              <Input id="typeRdv" placeholder="Ex: Examen, Suivi…" {...register("typeRdv")} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Création…" : "Créer le RDV"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
