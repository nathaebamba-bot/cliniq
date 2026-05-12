import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { addHours } from "date-fns"
import { estDansPlageHoraire } from "@/lib/utils"

// GET /api/test-formulaires
// Diagnostic: shows exactly why the formulaire auto-job would skip or fire for this org.
export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    include: { parametres: true },
  })
  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 })

  const params = org.parametres
  const maintenant = new Date()

  const formulaire = await db.formulaire.findFirst({
    where: { orgId: org.id, actif: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, nom: true, type: true },
  })

  const formulaireDelai = params?.formulaireDelai ?? 48
  const seuil = addHours(maintenant, formulaireDelai)

  const rdvs = await db.rendezVous.findMany({
    where: { orgId: org.id, dateHeure: { gte: maintenant, lte: seuil } },
    include: { patient: true, praticien: true },
    orderBy: { dateHeure: "asc" },
  })

  const heureOk = params
    ? estDansPlageHoraire(params.heureDebutEnvoi, params.heureFinEnvoi, params.fuseauHoraire)
    : false

  return NextResponse.json({
    maintenant: maintenant.toISOString(),
    org: { id: org.id, nom: org.nom },
    parametres: {
      existe: !!params,
      formulaireActif: params?.formulaireActif ?? null,
      formulaireDelai: params?.formulaireDelai ?? null,
      heureDebut: params?.heureDebutEnvoi ?? null,
      heureFin: params?.heureFinEnvoi ?? null,
      fuseau: params?.fuseauHoraire ?? null,
    },
    heureEnvoiOk: heureOk,
    formulaireActif: formulaire ? { id: formulaire.id, nom: formulaire.nom, type: formulaire.type } : null,
    fenetreRecherche: { debut: maintenant.toISOString(), fin: seuil.toISOString() },
    rdvsTrouvesTotal: rdvs.length,
    rdvs: rdvs.map((rdv) => {
      const blocages = [
        !params && "⛔ Aucun ParametresClinique — org jamais initialisée",
        params && !params.formulaireActif && "⛔ formulaireActif = false dans les paramètres",
        !heureOk && `⛔ Heure actuelle hors plage d'envoi (${params?.heureDebutEnvoi}–${params?.heureFinEnvoi} ${params?.fuseauHoraire})`,
        !formulaire && "⛔ Aucun formulaire actif dans l'org",
        rdv.formulaireEnvoye && "⛔ formulaireEnvoye déjà true",
        ["ANNULE", "NO_SHOW", "COMPLETE"].includes(rdv.statut) && `⛔ Statut ${rdv.statut} exclu`,
        !rdv.patient.consentementSMS && !rdv.patient.consentementCourriel && "⛔ Aucun consentement SMS ni courriel",
      ].filter(Boolean)

      return {
        id: rdv.id,
        patient: `${rdv.patient.prenom} ${rdv.patient.nom}`,
        dateHeure: rdv.dateHeure.toISOString(),
        statut: rdv.statut,
        formulaireEnvoye: rdv.formulaireEnvoye,
        consentementSMS: rdv.patient.consentementSMS,
        consentementCourriel: rdv.patient.consentementCourriel,
        telephone: rdv.patient.telephone,
        courriel: rdv.patient.courriel,
        blocages,
        seraEnvoye: blocages.length === 0,
      }
    }),
  })
}
