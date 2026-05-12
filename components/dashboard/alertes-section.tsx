"use client"

import Link from "next/link"
import { FileWarning, Clock, UserMinus, ChevronRight } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"

export function AlertesSection() {
  const { data, isLoading } = trpc.dashboard.actionsRequises.useQuery()

  if (isLoading) return <Skeleton className="h-36 w-full" />

  const items = [
    {
      icon: FileWarning,
      label: "Sans formulaire anamnèse",
      description: "RDV dans les 48h",
      count: data?.sansFormulaire ?? 0,
      href: "/formulaires",
      color: "text-brand-warning",
      bg: "bg-amber-50",
    },
    {
      icon: Clock,
      label: "Traitements incomplets",
      description: "Plus de 30 jours sans relance",
      count: data?.traitementIncomplet ?? 0,
      href: "/patients",
      color: "text-brand-primary",
      bg: "bg-blue-50",
    },
    {
      icon: UserMinus,
      label: "Patients inactifs",
      description: "Aucun RDV depuis 6 mois",
      count: data?.patientsInactifs ?? 0,
      href: "/patients",
      color: "text-text-secondary",
      bg: "bg-slate-50",
    },
  ]

  const actif = items.filter((i) => i.count > 0)

  if (actif.length === 0) {
    return (
      <p className="text-sm text-text-tertiary py-4 text-center">
        Aucune action requise. Tout est à jour !
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {actif.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg border border-border ${item.bg} px-3 py-3 hover:bg-opacity-80 transition-colors group`}
          >
            <div className={`p-2 rounded-lg bg-white border border-border`}>
              <Icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                <span className="font-semibold">{item.count}</span> {item.label}
              </p>
              <p className="text-xs text-text-tertiary">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-primary transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
