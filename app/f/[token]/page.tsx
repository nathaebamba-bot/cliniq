import { FormulairePublic } from "@/components/formulaires/formulaire-public"

export const metadata = { title: "Formulaire de sante" }

export default async function FormulairePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <FormulairePublic token={token} />
}