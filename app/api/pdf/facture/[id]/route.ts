import { auth } from "@clerk/nextjs/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"
import { db } from "@/lib/prisma"
import { FacturePDF, type FacturePDFData } from "@/components/pdf/facture-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return new Response("Unauthorized", { status: 401 })

  const { id } = await params

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true },
  })
  if (!org) return new Response("Organisation introuvable", { status: 404 })

  const facture = await db.facture.findFirst({
    where: { id, orgId: org.id },
    include: {
      patient: { select: { prenom: true, nom: true, courriel: true, telephone: true } },
      rendezvous: {
        select: {
          dateHeure: true,
          typeRdv: true,
          praticien: { select: { prenom: true, nom: true } },
        },
      },
      organisation: {
        select: { nom: true, adresse: true, ville: true, telephone: true, couleurPrimaire: true },
      },
    },
  })

  if (!facture) return new Response("Facture introuvable", { status: 404 })

  const data: FacturePDFData = {
    numero: facture.numero,
    createdAt: facture.createdAt,
    statut: facture.statut,
    lignes: facture.lignes as Array<{ description: string; montant: number }>,
    sousTotal: Number(facture.sousTotal),
    taxes: Number(facture.taxes),
    total: Number(facture.total),
    notes: facture.notes,
    destNom: facture.destNom,
    destCourriel: facture.destCourriel,
    patient: facture.patient,
    rendezvous: facture.rendezvous,
    organisation: facture.organisation,
  }

  const buffer = await renderToBuffer(
    createElement(FacturePDF, { data }) as unknown as ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${facture.numero}.pdf"`,
    },
  })
}
