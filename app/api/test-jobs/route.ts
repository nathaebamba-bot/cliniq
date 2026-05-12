import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { executerCollecteAvis } from "@/jobs/collecte-avis"
import { executerEnvoiRappels } from "@/jobs/envoi-rappels-rdv"
import { executerEnvoiFormulaires } from "@/jobs/envoi-formulaires"
import { executerRelanceTraitements } from "@/jobs/relance-traitements"

const JOBS: Record<string, () => Promise<unknown>> = {
  avis: executerCollecteAvis,
  rappels: executerEnvoiRappels,
  formulaires: executerEnvoiFormulaires,
  relance: executerRelanceTraitements,
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { job } = await req.json() as { job?: string }
  const fn = job ? JOBS[job] : undefined
  if (!fn) return NextResponse.json({ error: "job inconnu" }, { status: 400 })

  const result = await fn()
  if (result && typeof result === "object" && "erreurs" in result) {
    const { erreurs } = result as { erreurs: string[] }
    if (erreurs.length) console.error("[test-jobs] erreurs:", erreurs)
  }
  return NextResponse.json(result)
}