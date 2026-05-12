import { task, schedules } from "@trigger.dev/sdk/v3"
import { addHours, addDays } from "date-fns"
import { randomUUID } from "crypto"
import { createElement } from "react"
import { db } from "@/lib/prisma"
import { estDansPlageHoraire, interpolerMessage } from "@/lib/utils"
import { envoyerEtLogger } from "./lib/send-sms"
import { envoyerEtLoggerEmail } from "./lib/send-email"
import { FormulaireEmail } from "@/emails/formulaire-anamne"

export async function executerEnvoiFormulaires(): Promise<{ envoyes: number; ignores: number; erreurs: string[] }> {
  let envoyes = 0
  let ignores = 0
  const erreurs: string[] = []

  const orgs = await db.organisation.findMany({
    where: { parametres: { formulaireActif: true } },
    include: { parametres: true },
  })

  for (const org of orgs) {
    const params = org.parametres!
    const heureOk = estDansPlageHoraire(
      params.heureDebutEnvoi,
      params.heureFinEnvoi,
      params.fuseauHoraire
    )
    if (!heureOk) { ignores++; continue }

    // Get active form for this org's type
    const formulaire = await db.formulaire.findFirst({
      where: { orgId: org.id, actif: true },
      orderBy: { createdAt: "asc" },
    })
    if (!formulaire) { ignores++; continue }

    const seuil = addHours(new Date(), params.formulaireDelai)

    const rdvs = await db.rendezVous.findMany({
      where: {
        orgId: org.id,
        formulaireEnvoye: false,
        statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE"] },
        dateHeure: { lte: seuil, gte: new Date() },
      },
      include: { patient: true },
    })

    for (const rdv of rdvs) {
      if (!rdv.patient.consentementSMS && !rdv.patient.consentementCourriel) { ignores++; continue }
      try {
        // Skip if patient already completed any form in the last 180 days (patient-level, not RDV-level)
        const dejaComplete = await db.formulaireReponse.findFirst({
          where: {
            patientId: rdv.patientId,
            completeLe: { not: null, gte: addDays(new Date(), -180) },
          },
          select: { id: true },
        })
        if (dejaComplete) {
          await db.rendezVous.update({ where: { id: rdv.id }, data: { formulaireEnvoye: true } })
          ignores++
          continue
        }

        // Reuse any existing pending token for this patient (avoids duplicates regardless of which RDV it was linked to)
        const existant = await db.formulaireReponse.findFirst({
          where: { patientId: rdv.patientId, completeLe: null, expireA: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })

        let token: string
        let expireA: Date
        if (existant) {
          token = existant.lienToken
          expireA = existant.expireA
        } else {
          token = randomUUID()
          expireA = addHours(new Date(rdv.dateHeure), -24)
          await db.formulaireReponse.create({
            data: {
              formulaireId: formulaire.id,
              patientId: rdv.patient.id,
              rendezvousId: rdv.id,
              reponses: {} as import("@prisma/client").Prisma.InputJsonValue,
              lienToken: token,
              expireA,
            },
          })
        }

        const url = `${process.env.NEXT_PUBLIC_APP_URL}/f/${token}`

        // Mark as sent immediately — prevents infinite retries if SMS/email delivery fails
        await db.rendezVous.update({ where: { id: rdv.id }, data: { formulaireEnvoye: true } })

        if (rdv.patient.consentementSMS) {
          const corps = interpolerMessage(
            rdv.patient.langue === "EN"
              ? `Hello {{prenom}}, please complete your health form before your appointment: {{lien}}`
              : `Bonjour {{prenom}}, veuillez remplir votre formulaire de santé avant votre rendez-vous : {{lien}}`,
            { prenom: rdv.patient.prenom, lien: url }
          )
          await envoyerEtLogger({ orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "FORMULAIRE_ANAMNE", corps, telephone: rdv.patient.telephone })
        }

        if (rdv.patient.consentementCourriel && rdv.patient.courriel) {
          await envoyerEtLoggerEmail({
            orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "FORMULAIRE_ANAMNE",
            to: rdv.patient.courriel,
            sujet: rdv.patient.langue === "EN" ? `Your health form — please complete before your visit` : `Votre formulaire de santé — à compléter avant votre visite`,
            template: createElement(FormulaireEmail, { prenom: rdv.patient.prenom, nomFormulaire: formulaire.nom, lien: url, clinique: org.nom, langue: rdv.patient.langue }),
          })
        }

        envoyes++
      } catch (err) {
        ignores++
        erreurs.push(`RDV ${rdv.id} (${rdv.patient.prenom} ${rdv.patient.nom}): ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return { envoyes, ignores, erreurs }
}

export const envoiFormulairesTask = schedules.task({
  id: "envoi-formulaires-anamne",
  cron: "0 * * * *",
  run: async () => executerEnvoiFormulaires(),
})
