"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v3"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const schema = z.object({
  formulaireActif: z.boolean(),
  formulaireDelai: z.number().int().min(1).max(168),
})
type Form = z.infer<typeof schema>

export function FormulaireConfig() {
  const utils = trpc.useUtils()
  const { data: params, isLoading } = trpc.automatisation.getParametres.useQuery()

  const { register, handleSubmit, setValue, watch, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { formulaireActif: true, formulaireDelai: 48 },
  })

  useEffect(() => {
    if (params) {
      reset({
        formulaireActif: params.formulaireActif,
        formulaireDelai: params.formulaireDelai,
      })
    }
  }, [params, reset])

  const mutation = trpc.automatisation.upsertFormulaireAnamne.useMutation({
    onSuccess: () => {
      toast.success("Configuration sauvegardée.")
      utils.automatisation.liste.invalidate()
      utils.automatisation.getParametres.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium text-sm">Activer les formulaires automatiques</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Envoie un SMS avec le lien du formulaire avant chaque RDV.
          </p>
        </div>
        <Switch
          checked={watch("formulaireActif")}
          onCheckedChange={(v) => setValue("formulaireActif", v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Délai d'envoi avant le RDV (heures)</Label>
        <Input
          type="number"
          min={1}
          max={168}
          {...register("formulaireDelai", { valueAsNumber: true })}
        />
        <p className="text-xs text-text-tertiary">
          Le formulaire sera envoyé X heures avant le rendez-vous. Défaut : 48h.
        </p>
      </div>

      <div className="rounded-lg bg-bg-secondary border border-border p-3 text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Comment ça fonctionne</p>
        <p>1. Le patient reçoit un SMS avec un lien unique vers le formulaire.</p>
        <p>2. Le formulaire actif de votre clinique est utilisé (configurez-le dans Formulaires).</p>
        <p>3. Les réponses apparaissent dans le dossier patient dès la soumission.</p>
      </div>

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
      </Button>
    </form>
  )
}
