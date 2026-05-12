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
  relanceActif: z.boolean(),
  relanceDelaiJours: z.number().int().min(1).max(365),
})
type Form = z.infer<typeof schema>

export function RelanceConfig() {
  const utils = trpc.useUtils()
  const { data: params, isLoading } = trpc.automatisation.getParametres.useQuery()

  const { register, handleSubmit, setValue, watch, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { relanceActif: true, relanceDelaiJours: 30 },
  })

  useEffect(() => {
    if (params) {
      reset({
        relanceActif: params.relanceActif,
        relanceDelaiJours: params.relanceDelaiJours,
      })
    }
  }, [params, reset])

  const mutation = trpc.automatisation.upsertRelanceTraitement.useMutation({
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
          <p className="font-medium text-sm">Activer les relances traitements</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Relance les patients dont un traitement n'a pas été complété.
          </p>
        </div>
        <Switch
          checked={watch("relanceActif")}
          onCheckedChange={(v) => setValue("relanceActif", v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Délai avant relance (jours)</Label>
        <Input
          type="number"
          min={1}
          max={365}
          {...register("relanceDelaiJours", { valueAsNumber: true })}
        />
        <p className="text-xs text-text-tertiary">
          Si le traitement n'est pas marqué complété après X jours, un SMS de relance est envoyé.
        </p>
      </div>

      <div className="rounded-lg bg-bg-secondary border border-border p-3 text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Comment marquer un traitement complété ?</p>
        <p>Dans le dossier patient → onglet Rendez-vous → cliquez sur le RDV → changez le statut à "Complété".</p>
        <p className="mt-1">Les relances sont envoyées une seule fois par RDV, à 9h00 chaque jour.</p>
      </div>

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
      </Button>
    </form>
  )
}
