"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, ExternalLink, AlertTriangle, Download } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FORFAIT_LABELS, FORFAIT_PRIX, FORFAIT_LIMITES } from "@/lib/forfait"
import type { Forfait } from "@prisma/client"

const FORFAITS: { id: Forfait; description: string; features: string[] }[] = [
  {
    id: "DEMARRAGE",
    description: "Pour les petites cliniques",
    features: ["1 praticien", "500 SMS/mois", "Rappels RDV", "Formulaires anamnèse"],
  },
  {
    id: "CROISSANCE",
    description: "Pour les cliniques en croissance",
    features: ["5 praticiens", "2 000 SMS/mois", "Collecte d'avis Google", "Relances traitements", "Rapports avancés"],
  },
  {
    id: "CLINIQUE_PRO",
    description: "Pour les grandes cliniques",
    features: ["Praticiens illimités", "SMS illimités", "Agent vocal IA", "Export PDF", "Support prioritaire"],
  },
]

const STATUT_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  trialing: "Essai gratuit",
  unpaid: "Impayé",
  incomplete: "Incomplet",
}

export function FacturationTab() {
  const utils = trpc.useUtils()
  const { data: sub, isLoading: subLoading } = trpc.stripe.getSubscription.useQuery()
  const { data: invoices, isLoading: invoicesLoading } = trpc.stripe.getInvoices.useQuery()

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (e) => toast.error(e.message),
  })

  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (e) => toast.error(e.message),
  })

  const currentForfait = sub?.forfait ?? "DEMARRAGE"
  const hasSubscription = !!sub?.subscription
  const isPastDue = sub?.subscription?.status === "past_due"

  const appUrl = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="space-y-6">
      {/* Payment failed alert */}
      {isPastDue && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 text-brand-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Paiement en retard</p>
            <p className="text-sm text-red-600 mt-0.5">
              Votre dernier paiement a échoué. Veuillez mettre à jour votre moyen de paiement pour maintenir l'accès.
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-2"
              disabled={createPortal.isPending}
              onClick={() => createPortal.mutate({ returnUrl: `${appUrl}/parametres?tab=facturation` })}
            >
              Mettre à jour le paiement
            </Button>
          </div>
        </div>
      )}

      {/* Current plan summary */}
      {subLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium">Forfait actuel</p>
                <p className="text-xl font-display font-semibold text-text-primary mt-0.5">
                  {FORFAIT_LABELS[currentForfait]}
                </p>
                {sub?.subscription?.currentPeriodEnd && (
                  <p className="text-sm text-text-tertiary mt-1">
                    {sub.subscription.cancelAtPeriodEnd
                      ? `Actif jusqu'au ${format(sub.subscription.currentPeriodEnd, "d MMMM yyyy", { locale: fr })}`
                      : `Prochain renouvellement : ${format(sub.subscription.currentPeriodEnd, "d MMMM yyyy", { locale: fr })}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sub?.subscription?.status && (
                  <Badge variant={sub.subscription.status === "active" ? "default" : "destructive"}>
                    {STATUT_LABELS[sub.subscription.status] ?? sub.subscription.status}
                  </Badge>
                )}
                {hasSubscription && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={createPortal.isPending}
                    onClick={() => createPortal.mutate({ returnUrl: `${appUrl}/parametres?tab=facturation` })}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Gérer l'abonnement
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {FORFAITS.map((f) => {
          const isCurrent = f.id === currentForfait
          return (
            <Card
              key={f.id}
              className={`relative ${isCurrent ? "border-brand-primary ring-1 ring-brand-primary" : ""}`}
            >
              {isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-primary text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
                    Plan actuel
                  </span>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">{FORFAIT_LABELS[f.id]}</CardTitle>
                <p className="text-2xl font-semibold text-text-primary">{FORFAIT_PRIX[f.id]}</p>
                <p className="text-xs text-text-tertiary">{f.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5">
                  {f.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Check className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button
                    className="w-full"
                    variant={f.id === "CLINIQUE_PRO" ? "outline" : "default"}
                    disabled={createCheckout.isPending}
                    onClick={() =>
                      createCheckout.mutate({
                        forfait: f.id,
                        successUrl: `${appUrl}/parametres?tab=facturation&success=1`,
                        cancelUrl: `${appUrl}/parametres?tab=facturation`,
                      })
                    }
                  >
                    {f.id === "CLINIQUE_PRO" ? "Contacter l'équipe" : "Changer de forfait"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !invoices?.length ? (
            <p className="text-sm text-text-tertiary text-center py-4">Aucun paiement pour le moment.</p>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {inv.amount.toFixed(2)} {inv.currency}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {format(new Date(inv.date), "d MMMM yyyy", { locale: fr })}
                      {inv.number && ` · ${inv.number}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                      {inv.status === "paid" ? "Payé" : inv.status ?? "—"}
                    </Badge>
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
