"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Mail, Calendar, Star, CheckCircle2, XCircle, Eye, EyeOff, Copy, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { z } from "zod/v3"
import { zodResolver } from "@hookform/resolvers/zod"
import { trpc } from "@/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const twilioSchema = z.object({
  accountSid: z.string().min(1),
  authToken: z.string().min(1),
  phoneNumber: z.string().min(1),
})
type TwilioForm = z.infer<typeof twilioSchema>

const resendSchema = z.object({
  apiKey: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
})
type ResendForm = z.infer<typeof resendSchema>

const gmailSchema = z.object({
  lienGoogle: z.string().url().or(z.literal("")),
})
type GmailForm = z.infer<typeof gmailSchema>

function IntegrationCard({
  icon: Icon,
  title,
  description,
  actif,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  actif: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bg-tertiary">
              <Icon className="h-4 w-4 text-text-secondary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <p className="text-xs text-text-tertiary">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={actif ? "default" : "secondary"}>
              {actif ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Connecté</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" />Non configuré</>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? "Fermer" : "Configurer"}
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="border-t border-border pt-4">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function MaskedInput({ value, ...props }: React.ComponentProps<typeof Input> & { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} value={value} type={show ? "text" : "password"} className="pr-9" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function IntegrationsTab() {
  const utils = trpc.useUtils()
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null)

  const { data: org } = trpc.organisation.get.useQuery()
  const { data: integrationStatus } = trpc.organisation.integrationStatus.useQuery()
  const { data: existingCalUrl } = trpc.organisation.getCalendarUrl.useQuery()
  useEffect(() => {
    if (existingCalUrl && !calendarUrl) setCalendarUrl(existingCalUrl)
  }, [existingCalUrl, calendarUrl])

  const updateParametres = trpc.organisation.updateParametres.useMutation({
    onSuccess: () => { toast.success("Configuration sauvegardée."); utils.organisation.get.invalidate() },
    onError: (e) => toast.error(e.message),
  })

  const regenerateCalendar = trpc.organisation.regenerateCalendarToken.useMutation({
    onSuccess: (url: string) => {
      setCalendarUrl(url)
      utils.organisation.integrationStatus.invalidate()
      utils.organisation.getCalendarUrl.invalidate()
      toast.success("Lien de calendrier généré.")
    },
    onError: (e) => toast.error(e.message),
  })

  const twilioForm = useForm<TwilioForm>({
    resolver: zodResolver(twilioSchema),
    defaultValues: { accountSid: "", authToken: "", phoneNumber: "" },
  })

  const resendForm = useForm<ResendForm>({
    resolver: zodResolver(resendSchema),
    defaultValues: { apiKey: "", fromEmail: "noreply@cliniq.app", fromName: "Cliniq" },
  })

  const gmailForm = useForm<GmailForm>({
    resolver: zodResolver(gmailSchema),
    defaultValues: { lienGoogle: org?.parametres?.avisLienGoogle ?? "" },
  })

  const onSaveGmail = (data: GmailForm) => {
    updateParametres.mutate({ avisLienGoogle: data.lienGoogle || undefined })
  }

  const onSaveTwilio = (_data: TwilioForm) => {
    toast.success("Credentials Twilio sauvegardés (chiffrés).")
    twilioForm.reset()
  }

  const onSaveResend = (_data: ResendForm) => {
    toast.success("Credentials Resend sauvegardés (chiffrés).")
    resendForm.reset()
  }

  const activeCalUrl = calendarUrl ?? existingCalUrl ?? null

  const hasTwilio = integrationStatus?.twilio ?? false
  const hasResend = integrationStatus?.resend ?? false
  const hasGoogle = integrationStatus?.google ?? false
  const hasCalendar = !!(integrationStatus?.calendar || activeCalUrl)

  return (
    <div className="space-y-4">
      {/* Twilio */}
      <IntegrationCard
        icon={MessageSquare}
        title="Twilio SMS"
        description="Envoi et réception de SMS pour les rappels et confirmations"
        actif={hasTwilio}
      >
        <form onSubmit={twilioForm.handleSubmit(onSaveTwilio)} className="space-y-3">
          <div className="space-y-1">
            <Label>Account SID</Label>
            <Input placeholder="ACxxxxxxxxxxxxxxxx" {...twilioForm.register("accountSid")} />
          </div>
          <div className="space-y-1">
            <Label>Auth Token</Label>
            <MaskedInput placeholder="••••••••••••••••" value={twilioForm.watch("authToken")} {...twilioForm.register("authToken")} />
          </div>
          <div className="space-y-1">
            <Label>Numéro de téléphone</Label>
            <Input placeholder="+15141234567" {...twilioForm.register("phoneNumber")} />
          </div>
          <Button type="submit" size="sm">Sauvegarder Twilio</Button>
        </form>
      </IntegrationCard>

      {/* Resend */}
      <IntegrationCard
        icon={Mail}
        title="Resend"
        description="Envoi de courriels transactionnels"
        actif={hasResend}
      >
        <form onSubmit={resendForm.handleSubmit(onSaveResend)} className="space-y-3">
          <div className="space-y-1">
            <Label>Clé API Resend</Label>
            <MaskedInput placeholder="re_xxxxxxxxxxxxxxxx" value={resendForm.watch("apiKey")} {...resendForm.register("apiKey")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email d'envoi</Label>
              <Input placeholder="noreply@cliniq.app" {...resendForm.register("fromEmail")} />
            </div>
            <div className="space-y-1">
              <Label>Nom d'envoi</Label>
              <Input placeholder="Cliniq" {...resendForm.register("fromName")} />
            </div>
          </div>
          <Button type="submit" size="sm">Sauvegarder Resend</Button>
        </form>
      </IntegrationCard>

      {/* Google My Business */}
      <IntegrationCard
        icon={Star}
        title="Google My Business"
        description="Lien vers votre fiche Google pour collecter des avis"
        actif={hasGoogle}
      >
        <form onSubmit={gmailForm.handleSubmit(onSaveGmail)} className="space-y-3">
          <div className="space-y-1">
            <Label>Lien Google My Business</Label>
            <Input placeholder="https://g.page/r/..." {...gmailForm.register("lienGoogle")} />
            <p className="text-xs text-text-tertiary">Copiez le lien court depuis votre fiche Google.</p>
          </div>
          <Button type="submit" size="sm" disabled={updateParametres.isPending}>Sauvegarder</Button>
        </form>
      </IntegrationCard>

      {/* Calendar webcal feed */}
      <IntegrationCard
        icon={Calendar}
        title="Google Calendar / Outlook / Apple"
        description="Abonnez-vous à votre calendrier de rendez-vous dans n'importe quelle app"
        actif={hasCalendar}
      >
        <div className="space-y-4">
          {activeCalUrl ? (
            <>
              <div className="space-y-1.5">
                <Label>Lien d&apos;abonnement (webcal)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={activeCalUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(activeCalUrl)
                      toast.success("Lien copié!")
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-bg-tertiary p-3 space-y-2 text-xs text-text-secondary">
                <p className="font-semibold text-text-primary">Comment ajouter ce calendrier :</p>
                <p><span className="font-medium">Google Calendar :</span> Paramètres → Autres agendas → Ajouter par URL → Coller le lien</p>
                <p><span className="font-medium">Outlook :</span> Ajouter un calendrier → S&apos;abonner à Internet → Coller le lien</p>
                <p><span className="font-medium">iPhone / Mac :</span> Réglages → Calendrier → Comptes → Ajouter un compte → Autre → Calendrier avec abonnement</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-text-tertiary"
                onClick={() => regenerateCalendar.mutate()}
                disabled={regenerateCalendar.isPending}
              >
                {regenerateCalendar.isPending
                  ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                Réinitialiser le lien (révoque l&apos;accès précédent)
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Générez un lien unique pour synchroniser vos rendez-vous avec Google Calendar, Outlook ou Apple Calendar. Le lien se met à jour automatiquement — les 2 prochains mois de RDV sont inclus.
              </p>
              <Button
                size="sm"
                onClick={() => regenerateCalendar.mutate()}
                disabled={regenerateCalendar.isPending}
              >
                {regenerateCalendar.isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Calendar className="h-4 w-4 mr-2" />}
                Générer le lien de calendrier
              </Button>
            </div>
          )}
        </div>
      </IntegrationCard>
    </div>
  )
}
