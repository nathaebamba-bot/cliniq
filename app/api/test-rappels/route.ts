import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { addHours } from "date-fns"

// GET /api/test-rappels
// Diagnostic endpoint — shows exactly why a reminder would/wouldn't fire.
// Protected: requires a logged-in Clerk session.
export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    include: { parametres: true },
  })
  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 })

  const maintenant = new Date()
  const debut48 = addHours(maintenant, 44)
  const fin48 = addHours(maintenant, 52)

  const rdvs = await db.rendezVous.findMany({
    where: {
      orgId: org.id,
      dateHeure: { gte: debut48, lte: fin48 },
    },
    include: {
      patient: true,
      praticien: true,
    },
  })

  const rapport = {
    maintenant: maintenant.toISOString(),
    org: { id: org.id, nom: org.nom },
    parametres: {
      rappelActif: org.parametres?.rappelActif ?? null,
      rappelDelai48h: org.parametres?.rappelDelai48h ?? null,
      heureDebut: org.parametres?.heureDebutEnvoi ?? null,
      heureFin: org.parametres?.heureFinEnvoi ?? null,
      fuseau: org.parametres?.fuseauHoraire ?? null,
    },
    parametresExistent: !!org.parametres,
    fenetreRecherche: { debut: debut48.toISOString(), fin: fin48.toISOString() },
    rdvsTrouves: rdvs.length,
    rdvs: rdvs.map((rdv) => ({
      id: rdv.id,
      dateHeure: rdv.dateHeure.toISOString(),
      statut: rdv.statut,
      rappel48hEnvoye: rdv.rappel48hEnvoye,
      patient: {
        prenom: rdv.patient.prenom,
        nom: rdv.patient.nom,
        telephone: rdv.patient.telephone,
        consentementSMS: rdv.patient.consentementSMS,
        telephoneFormatOk: rdv.patient.telephone.startsWith("+"),
      },
      blocages: [
        !org.parametres && "⛔ Aucun ParametresClinique — org jamais initialisée",
        org.parametres && !org.parametres.rappelActif && "⛔ rappelActif = false",
        org.parametres && !org.parametres.rappelDelai48h && "⛔ rappelDelai48h = false",
        !rdv.patient.consentementSMS && "⛔ consentementSMS = false sur le patient",
        !rdv.patient.telephone.startsWith("+") && "⛔ Numéro pas en format E.164 (doit commencer par +1…)",
        rdv.rappel48hEnvoye && "⛔ rappel48hEnvoye déjà true (déjà envoyé)",
        ["ANNULE", "NO_SHOW", "COMPLETE"].includes(rdv.statut) && `⛔ Statut ${rdv.statut} exclu`,
      ].filter(Boolean),
    })),
  }

  return NextResponse.json(rapport, { status: 200 })
}
