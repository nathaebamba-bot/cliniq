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
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

const schema = z.object({
  avisActif: z.boolean(),
  avisDelaiApresRdv: z.number().int().min(0).max(72),
  avisMessageSMS: z.string().min(1),
  avisLienGoogle: z.string().url("URL invalide").or(z.literal("")),
})
type Form = z.infer<typeof schema>

const DEFAULT_MSG = "Bonjour {{prenom}}, merci pour votre visite! Votre avis nous aide beaucoup : {{lien}}"

export function AvisConfig() {
  const utils = trpc.useUtils()
  const { data: params, isLoading } = trpc.automatisation.getParametres.useQuery()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      avisActif: true,
      avisDelaiApresRdv: 2,
      avisMessageSMS: DEFAULT_MSG,
      avisLienGoogle: "",
    },
  })

  useEffect(() => {
    if (params) {
      reset({
        avisActif: params.avisActif,
        avisDelaiApresRdv: params.avisDelaiApresRdv,
        avisMessageSMS: params.avisMessageSMS,
        avisLienGoogle: params.avisLienGoogle ?? "",
      })
    }
  }, [params, reset])

  const mutation = trpc.automatisation.upsertCollecteAvis.useMutation({
    onSuccess: () => {
      toast.success("Configuration sauvegardée.")
      utils.automatisation.liste.invalidate()
      utils.automatisation.getParametres.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const msgValue = watch("avisMessageSMS")

  if (isLoading) return <Skeleton className="h-60 w-full" />

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium text-sm">Activer la collecte d'avis</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Envoie automatiquement un SMS après chaque consultation complétée.
          </p>
        </div>
        <Switch
          checked={watch("avisActif")}
          onCheckedChange={(v) => setValue("avisActif", v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Lien Google My Business</Label>
        <Input placeholder="https://g.page/r/..." {...register("avisLienGoogle")} />
        {errors.avisLienGoogle && (
          <p className="text-xs text-red-500">{errors.avisLienGoogle.message}</p>
        )}
        <p className="text-xs text-text-tertiary">Copiez le lien court depuis votre fiche Google.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Délai d'envoi après le RDV (heures)</Label>
        <Input
          type="number"
          min={0}
          max={72}
          {...register("avisDelaiApresRdv", { valueAsNumber: true })}
        />
        <p className="text-xs text-text-tertiary">0 = envoi immédiat après le RDV marqué Complété.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Message SMS</Label>
        <Textarea rows={3} {...register("avisMessageSMS")} />
        <p className="text-xs text-text-tertiary">
          Variables : {"{{"}<span>prenom</span>{"}}"}, {"{{"}<span>lien</span>{"}}"}
          {" "}— {msgValue?.length ?? 0} caractères
        </p>
      </div>

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
      </Button>
    </form>
  )
}
