"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v3"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const VARIABLES = ["{{prenom}}", "{{nom}}", "{{date}}", "{{heure}}", "{{praticien}}", "{{clinique}}"]

const schema = z.object({
  rappelActif: z.boolean(),
  rappelDelai48h: z.boolean(),
  rappelDelai24h: z.boolean(),
  rappelDelai2h: z.boolean(),
  messageSMS48h: z.string().min(1),
  messageSMS24h: z.string().min(1),
  heureDebutEnvoi: z.string(),
  heureFinEnvoi: z.string(),
})

type FormValues = z.infer<typeof schema>

export function RappelConfig() {
  const utils = trpc.useUtils()
  const { data: params } = trpc.automatisation.getParametres.useQuery()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rappelActif: true,
      rappelDelai48h: true,
      rappelDelai24h: true,
      rappelDelai2h: false,
      messageSMS48h:
        "Bonjour {{prenom}}, rappel de votre RDV chez {{clinique}} le {{date}} à {{heure}} avec {{praticien}}. Confirmez avec 1 ou annulez avec 2.",
      messageSMS24h:
        "Bonjour {{prenom}}, votre RDV est demain à {{heure}} avec {{praticien}}. À demain !",
      heureDebutEnvoi: "08:00",
      heureFinEnvoi: "20:00",
    },
  })

  // Sync form with loaded params
  useEffect(() => {
    if (params) {
      reset({
        rappelActif: params.rappelActif,
        rappelDelai48h: params.rappelDelai48h,
        rappelDelai24h: params.rappelDelai24h,
        rappelDelai2h: params.rappelDelai2h,
        messageSMS48h: params.messageSMS48h,
        messageSMS24h: params.messageSMS24h,
        heureDebutEnvoi: params.heureDebutEnvoi,
        heureFinEnvoi: params.heureFinEnvoi,
      })
    }
  }, [params, reset])

  const mutation = trpc.automatisation.upsertRappelRdv.useMutation({
    onSuccess: () => {
      utils.automatisation.liste.invalidate()
      utils.automatisation.getParametres.invalidate()
      toast.success("Configuration sauvegardée.")
    },
    onError: (e) => toast.error(e.message),
  })

  const onSubmit = (data: FormValues) => mutation.mutate(data)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Global toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">Rappels actifs</p>
          <p className="text-sm text-text-secondary">Activer / désactiver tous les rappels automatiques</p>
        </div>
        <Switch
          checked={watch("rappelActif")}
          onCheckedChange={(v) => setValue("rappelActif", v, { shouldDirty: true })}
        />
      </div>

      {/* Timing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timing des rappels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { field: "rappelDelai48h" as const, label: "48h avant le RDV" },
            { field: "rappelDelai24h" as const, label: "24h avant le RDV" },
            { field: "rappelDelai2h" as const, label: "2h avant le RDV" },
          ].map(({ field, label }) => (
            <div key={field} className="flex items-center justify-between py-1">
              <Label className="font-normal">{label}</Label>
              <Switch
                checked={watch(field)}
                onCheckedChange={(v) => setValue(field, v, { shouldDirty: true })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Message templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Templates SMS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 flex-wrap">
            {VARIABLES.map((v) => (
              <Badge key={v} variant="outline" className="text-xs font-mono cursor-default">
                {v}
              </Badge>
            ))}
          </div>

          <div className="space-y-1">
            <Label>Message 48h avant</Label>
            <Textarea rows={3} {...register("messageSMS48h")} className="font-mono text-sm" />
            <p className="text-xs text-text-tertiary">
              {watch("messageSMS48h")?.length ?? 0} caractères
            </p>
          </div>

          <div className="space-y-1">
            <Label>Message 24h avant</Label>
            <Textarea rows={2} {...register("messageSMS24h")} className="font-mono text-sm" />
            <p className="text-xs text-text-tertiary">
              {watch("messageSMS24h")?.length ?? 0} caractères
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sending window */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fenêtre d'envoi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary mb-3">
            Les SMS ne seront jamais envoyés en dehors de cette plage horaire.
          </p>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="time" {...register("heureDebutEnvoi")} className="w-32" />
            </div>
            <span className="text-text-tertiary mt-5">→</span>
            <div className="space-y-1">
              <Label>À</Label>
              <Input type="time" {...register("heureFinEnvoi")} className="w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={!isDirty || mutation.isPending}>
        {mutation.isPending ? "Sauvegarde…" : "Sauvegarder la configuration"}
      </Button>
    </form>
  )
}
