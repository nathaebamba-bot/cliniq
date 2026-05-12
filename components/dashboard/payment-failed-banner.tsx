"use client"

import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"

export function PaymentFailedBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { data: sub } = trpc.stripe.getSubscription.useQuery()

  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (e) => toast.error(e.message),
  })

  if (dismissed || sub?.subscription?.status !== "past_due") return null

  const appUrl = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="flex items-center gap-3 bg-red-50 border-b border-red-200 px-4 py-2.5">
      <AlertTriangle className="h-4 w-4 text-brand-danger shrink-0" />
      <p className="flex-1 text-sm text-red-700">
        <strong>Paiement échoué.</strong> Mettez à jour votre moyen de paiement pour maintenir l'accès.
      </p>
      <Button
        size="sm"
        variant="destructive"
        className="h-7 text-xs"
        disabled={createPortal.isPending}
        onClick={() => createPortal.mutate({ returnUrl: `${appUrl}/parametres?tab=facturation` })}
      >
        Corriger
      </Button>
      <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
