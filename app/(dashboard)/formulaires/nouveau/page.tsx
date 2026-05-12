import { Topbar } from "@/components/dashboard/topbar"
import { FormulaireBuilder } from "@/components/formulaires/formulaire-builder"

export const metadata = { title: "Nouveau formulaire" }

export default function NouveauFormulairePage() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <Topbar title="Nouveau formulaire" />
      <FormulaireBuilder />
    </div>
  )
}
