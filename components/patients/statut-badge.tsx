import { Badge } from "@/components/ui/badge"
import type { StatutRdv } from "@prisma/client"
import { cn } from "@/lib/utils"

const CONFIG: Record<StatutRdv, { label: string; className: string }> = {
  PLANIFIE:   { label: "Planifié",    className: "bg-slate-100 text-slate-700" },
  CONFIRME:   { label: "Confirmé",    className: "bg-blue-100 text-blue-700" },
  ARRIVE:     { label: "Arrivé",      className: "bg-indigo-100 text-indigo-700" },
  COMPLETE:   { label: "Complété",    className: "bg-green-100 text-green-700" },
  NO_SHOW:    { label: "No-show",     className: "bg-red-100 text-red-700" },
  ANNULE:     { label: "Annulé",      className: "bg-orange-100 text-orange-700" },
  REPLANIFIE: { label: "Replanifié",  className: "bg-yellow-100 text-yellow-700" },
}

export function StatutBadge({ statut }: { statut: StatutRdv }) {
  const cfg = CONFIG[statut]
  return (
    <Badge className={cn("border-0 font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  )
}
