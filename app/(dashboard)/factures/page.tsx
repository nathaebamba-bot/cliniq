import { Topbar } from "@/components/dashboard/topbar"
import { FacturesClient } from "@/components/factures/factures-client"

export const metadata = { title: "Factures" }

export default function FacturesPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Topbar title="Factures" />
      <FacturesClient />
    </div>
  )
}
