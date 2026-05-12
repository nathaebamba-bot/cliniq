"use client"

import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { MessageSquare, Mail, Phone, CheckCircle, XCircle, Clock, Send } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"

const TYPE_LABELS: Record<string, string> = {
  RAPPEL_RDV: "Rappel RDV",
  CONFIRMATION_RDV: "Confirmation RDV",
  FORMULAIRE_ANAMNE: "Formulaire anamnèse",
  COLLECTE_AVIS: "Demande d'avis",
  RELANCE_TRAITEMENT: "Relance traitement",
  RAPPEL_HYGIENE: "Rappel hygiène",
  CAMPAGNE_MARKETING: "Campagne",
  REPONSE_ENTRANTE: "Réponse reçue",
}

const CANAL_ICON: Record<string, React.ElementType> = {
  SMS: MessageSquare,
  COURRIEL: Mail,
  VOCAL: Phone,
}

const STATUT_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  ENVOYE: { icon: Send, color: "text-brand-primary" },
  DELIVRE: { icon: CheckCircle, color: "text-brand-accent" },
  LU: { icon: CheckCircle, color: "text-brand-accent" },
  ECHEC: { icon: XCircle, color: "text-brand-danger" },
  EN_ATTENTE: { icon: Clock, color: "text-text-tertiary" },
  REPONDU: { icon: MessageSquare, color: "text-brand-primary" },
}

export function ActivityFeed() {
  const { data, isLoading } = trpc.dashboard.activiteRecente.useQuery({ limit: 20 })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-text-tertiary py-4 text-center">
        Aucune activité récente.
      </p>
    )
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {data.map((comm) => {
        const CanalIcon = CANAL_ICON[comm.canal] ?? MessageSquare
        const statutInfo = STATUT_ICON[comm.statut] ?? STATUT_ICON.EN_ATTENTE
        const StatutIcon = statutInfo.icon

        return (
          <div key={comm.id} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
              <CanalIcon className="h-3.5 w-3.5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-text-primary truncate">
                  {comm.patient.prenom} {comm.patient.nom}
                </span>
                <span className="text-xs text-text-tertiary shrink-0">·</span>
                <span className="text-xs text-text-tertiary shrink-0">
                  {TYPE_LABELS[comm.type] ?? comm.type}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <StatutIcon className={`h-3 w-3 ${statutInfo.color}`} />
                <span className="text-xs text-text-tertiary">
                  {formatDistanceToNow(new Date(comm.createdAt), { locale: fr, addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
