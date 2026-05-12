import { Topbar } from "@/components/dashboard/topbar"
import { FormulairesList } from "@/components/formulaires/formulaires-list"

export const metadata = { title: "Formulaires" }

export default function FormulairesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Formulaires anamnèse" />
      <FormulairesList />
    </div>
  )
}
