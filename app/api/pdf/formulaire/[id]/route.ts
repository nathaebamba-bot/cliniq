import { auth } from "@clerk/nextjs/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"
import { db } from "@/lib/prisma"
import { FormulairePDF } from "@/components/pdf/formulaire-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return new Response("Unauthorized", { status: 401 })

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true, nom: true },
  })
  if (!org) return new Response("Not found", { status: 404 })

  const reponse = await db.formulaireReponse.findFirst({
    where: { id, patient: { orgId: org.id } },
    include: { formulaire: true, patient: true },
  })
  if (!reponse) return new Response("Not found", { status: 404 })

  const questions = reponse.formulaire.questions as Array<{
    id: string
    type: string
    question: string
    obligatoire?: boolean
    options?: string[]
  }>

  const buffer = await renderToBuffer(
    createElement(FormulairePDF, {
      nomClinique: org.nom,
      nomPatient: `${reponse.patient.prenom} ${reponse.patient.nom}`,
      nomFormulaire: reponse.formulaire.nom,
      completeLe: reponse.completeLe,
      questions,
      reponses: (reponse.reponses ?? {}) as Record<string, unknown>,
    }) as unknown as ReactElement<DocumentProps>
  )

  const filename = `formulaire-${reponse.patient.nom}-${reponse.patient.prenom}.pdf`
    .toLowerCase()
    .replace(/\s+/g, "-")

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
