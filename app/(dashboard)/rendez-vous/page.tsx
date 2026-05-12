import { Topbar } from "@/components/dashboard/topbar"
import { CalendrierRdv } from "@/components/rendez-vous/calendrier"

export const metadata = { title: "Rendez-vous" }

export default function RendezVousPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Topbar title="Rendez-vous" />
      <CalendrierRdv />
    </div>
  )
}
