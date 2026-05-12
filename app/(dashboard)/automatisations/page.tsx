import { Topbar } from "@/components/dashboard/topbar"
import { AutomatisationsList } from "@/components/automatisations/automatisations-list"

export const metadata = { title: "Automatisations" }

export default function AutomatisationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Automatisations" />
      <AutomatisationsList />
    </div>
  )
}
