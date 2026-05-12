import { AvisPage } from "@/components/avis/avis-page"
import { Topbar } from "@/components/dashboard/topbar"

export const metadata = { title: "Avis Google" }

export default function AvisGooglePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Avis Google" />
      <AvisPage />
    </div>
  )
}