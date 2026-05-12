import { auth } from "@clerk/nextjs/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"
import { format } from "date-fns"
import { db } from "@/lib/prisma"
import { RapportPDF, type RapportData } from "@/components/pdf/rapport-pdf"

export async function GET(req: Request) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return new Response("Unauthorized", { status: 401 })

  const url = new URL(req.url)
  const annee = parseInt(url.searchParams.get("annee") ?? String(new Date().getFullYear()))
  const mois = parseInt(url.searchParams.get("mois") ?? String(new Date().getMonth() + 1))

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true, nom: true },
  })
  if (!org) return new Response("Organisation introuvable", { status: 404 })

  const debut = new Date(annee, mois - 1, 1)
  const fin = new Date(annee, mois, 0, 23, 59, 59)

  const [totalRdv, noShows, confirmes, avisEnvoyes, formulairesComplete, relancesEnvoyees] =
    await Promise.all([
      db.rendezVous.count({ where: { orgId: org.id, dateHeure: { gte: debut, lte: fin } } }),
      db.rendezVous.count({ where: { orgId: org.id, statut: "NO_SHOW", dateHeure: { gte: debut, lte: fin } } }),
      db.rendezVous.count({ where: { orgId: org.id, confirmeParPatient: true, dateHeure: { gte: debut, lte: fin } } }),
      db.avisGoogle.count({ where: { orgId: org.id, createdAt: { gte: debut, lte: fin } } }),
      db.formulaireReponse.count({ where: { patient: { orgId: org.id }, completeLe: { gte: debut, lte: fin } } }),
      db.rendezVous.count({ where: { orgId: org.id, relanceEnvoyee: true, updatedAt: { gte: debut, lte: fin } } }),
    ])

  const parSemaineRaw = await db.$queryRaw<Array<{ semaine: Date; total: bigint; noshows: bigint }>>`
    SELECT
      DATE_TRUNC('week', "dateHeure") AS semaine,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE statut = 'NO_SHOW') AS noshows
    FROM "RendezVous"
    WHERE "orgId" = ${org.id}
      AND "dateHeure" >= ${debut}
      AND "dateHeure" <= ${fin}
    GROUP BY semaine
    ORDER BY semaine
  `

  const tauxNoShow = totalRdv > 0 ? Math.round((noShows / totalRdv) * 100) : 0
  const tauxConfirmation = totalRdv > 0 ? Math.round((confirmes / totalRdv) * 100) : 0

  const data: RapportData = {
    nomClinique: org.nom,
    annee,
    mois,
    totalRdv,
    noShows,
    tauxNoShow,
    noShowsEvites: confirmes,
    confirmes,
    tauxConfirmation,
    avisEnvoyes,
    formulairesComplete,
    relancesEnvoyees,
    revenusRecuperes: confirmes * 150,
    parSemaine: parSemaineRaw.map((r) => ({
      semaine: format(new Date(r.semaine), "yyyy-MM-dd"),
      total: Number(r.total),
      noShows: Number(r.noshows),
    })),
  }

  const buffer = await renderToBuffer(
    createElement(RapportPDF, { data }) as unknown as ReactElement<DocumentProps>
  )
  const filename = `rapport-${annee}-${String(mois).padStart(2, "0")}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
