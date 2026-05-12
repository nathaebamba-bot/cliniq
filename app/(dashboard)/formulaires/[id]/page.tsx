import { FormulaireDetailPage } from "@/components/formulaires/formulaire-detail-page"

export const metadata = { title: "Formulaire" }

export default async function FormulairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FormulaireDetailPage formulaireId={id} />
}
