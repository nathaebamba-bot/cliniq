import { task, schedules } from "@trigger.dev/sdk/v3"
import { addHours } from "date-fns"
import { createElement } from "react"
import { db } from "@/lib/prisma"
import { estDansPlageHoraire } from "@/lib/utils"
import { buildVariables, interpoler } from "./lib/interpoler"
import { envoyerEtLogger } from "./lib/send-sms"
import { envoyerEtLoggerEmail } from "./lib/send-email"
import { RappelRdvEmail } from "@/emails/rappel-rdv"

// ── Core logic ────────────────────────────────────────────────────────────────

export async function executerEnvoiRappels(): Promise<{
  envoyes: number
  ignores: number
  erreurs: number
}> {
  const maintenant = new Date()
  let envoyes = 0
  let ignores = 0
  let erreurs = 0

  // Find all organisations with active reminders
  const orgs = await db.organisation.findMany({
    where: { parametres: { rappelActif: true } },
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

    // ── 48h reminder ───────────────────────────────────────────────────────
    if (params.rappelDelai48h) {
      const debut48 = addHours(maintenant, 47)
      const fin48 = addHours(maintenant, 49)

      const rdvs48 = await db.rendezVous.findMany({
        where: {
          orgId: org.id,
          rappel48hEnvoye: false,
          statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE"] },
          dateHeure: { gte: debut48, lte: fin48 },
        },
        include: {
          patient: true,
          praticien: true,
        },
      })

      for (const rdv of rdvs48) {
        if (!rdv.patient.consentementSMS && !rdv.patient.consentementCourriel) { ignores++; continue }
        try {
          const vars = buildVariables(rdv.patient, rdv.dateHeure, rdv.praticien, org)
          const envoiSMS = rdv.patient.consentementSMS && params.rappelCanal !== "COURRIEL_SEULEMENT"
          const envoiEmail = rdv.patient.consentementCourriel && rdv.patient.courriel && params.rappelCanal !== "SMS_SEULEMENT"

          if (envoiSMS) {
            const corps = interpoler(rdv.patient.langue === "EN"
              ? `Hello {{prenom}}, reminder of your appointment at {{clinique}} on {{date}} at {{heure}} with {{praticien}}. Confirm with 1 or cancel with 2.`
              : params.messageSMS48h, vars)
            await envoyerEtLogger({ orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "RAPPEL_RDV", corps, telephone: rdv.patient.telephone })
          }
          if (envoiEmail) {
            await envoyerEtLoggerEmail({
              orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "RAPPEL_RDV",
              to: rdv.patient.courriel!,
              sujet: rdv.patient.langue === "EN" ? `Appointment reminder — ${vars.date} at ${vars.heure}` : `Rappel de rendez-vous — ${vars.date} à ${vars.heure}`,
              template: createElement(RappelRdvEmail, { prenom: rdv.patient.prenom, date: vars.date, heure: vars.heure, praticien: vars.praticien, clinique: org.nom, langue: rdv.patient.langue }),
            })
          }
          await db.rendezVous.update({ where: { id: rdv.id }, data: { rappel48hEnvoye: true } })
          envoyes++
        } catch {
          erreurs++
        }
      }
    }

    // ── 24h reminder ───────────────────────────────────────────────────────
    if (params.rappelDelai24h) {
      const debut24 = addHours(maintenant, 23)
      const fin24 = addHours(maintenant, 25)

      const rdvs24 = await db.rendezVous.findMany({
        where: {
          orgId: org.id,
          rappel24hEnvoye: false,
          statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE"] },
          dateHeure: { gte: debut24, lte: fin24 },
        },
        include: { patient: true, praticien: true },
      })

      for (const rdv of rdvs24) {
        if (!rdv.patient.consentementSMS && !rdv.patient.consentementCourriel) { ignores++; continue }
        try {
          const vars = buildVariables(rdv.patient, rdv.dateHeure, rdv.praticien, org)
          const envoiSMS = rdv.patient.consentementSMS && params.rappelCanal !== "COURRIEL_SEULEMENT"
          const envoiEmail = rdv.patient.consentementCourriel && rdv.patient.courriel && params.rappelCanal !== "SMS_SEULEMENT"

          if (envoiSMS) {
            const corps = interpoler(rdv.patient.langue === "EN"
              ? `Hello {{prenom}}, your appointment is tomorrow at {{heure}} with {{praticien}}. See you tomorrow!`
              : params.messageSMS24h, vars)
            await envoyerEtLogger({ orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "RAPPEL_RDV", corps, telephone: rdv.patient.telephone })
          }
          if (envoiEmail) {
            await envoyerEtLoggerEmail({
              orgId: org.id, patientId: rdv.patient.id, rendezvousId: rdv.id, type: "RAPPEL_RDV",
              to: rdv.patient.courriel!,
              sujet: rdv.patient.langue === "EN" ? `See you tomorrow — ${vars.heure} with ${vars.praticien}` : `À demain — ${vars.heure} avec ${vars.praticien}`,
              template: createElement(RappelRdvEmail, { prenom: rdv.patient.prenom, date: vars.date, heure: vars.heure, praticien: vars.praticien, clinique: org.nom, langue: rdv.patient.langue }),
            })
          }
          await db.rendezVous.update({ where: { id: rdv.id }, data: { rappel24hEnvoye: true } })
          envoyes++
        } catch {
          erreurs++
        }
      }
    }

    // ── 2h reminder ───────────────────────────────────────────────────────
    if (params.rappelDelai2h) {
      const debut2 = addHours(maintenant, 1.5)
      const fin2 = addHours(maintenant, 2.5)

      const rdvs2 = await db.rendezVous.findMany({
        where: {
          orgId: org.id,
          rappel2hEnvoye: false,
          statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE"] },
          dateHeure: { gte: debut2, lte: fin2 },
        },
        include: { patient: true, praticien: true },
      })

      for (const rdv of rdvs2) {
        if (!rdv.patient.consentementSMS) { ignores++; continue }
        try {
          const vars = buildVariables(rdv.patient, rdv.dateHeure, rdv.praticien, org)
          const corps = interpoler(
            rdv.patient.langue === "EN"
              ? `Reminder: your appointment at {{clinique}} is in about 2 hours ({{heure}}) with {{praticien}}.`
              : `Rappel : votre rendez-vous chez {{clinique}} est dans environ 2h ({{heure}}) avec {{praticien}}.`,
            vars
          )
          await envoyerEtLogger({
            orgId: org.id,
            patientId: rdv.patient.id,
            rendezvousId: rdv.id,
            type: "RAPPEL_RDV",
            corps,
            telephone: rdv.patient.telephone,
          })
          await db.rendezVous.update({
            where: { id: rdv.id },
            data: { rappel2hEnvoye: true },
          })
          envoyes++
        } catch {
          erreurs++
        }
      }
    }

    // Update automation stats
    await db.automatisation.updateMany({
      where: { orgId: org.id, type: "RAPPEL_RDV" },
      data: {
        totalDeclenche: { increment: 1 },
        totalSucces: { increment: envoyes },
        totalEchec: { increment: erreurs },
        dernierDeclenchement: maintenant,
      },
    })
  }

  return { envoyes, ignores, erreurs }
}

// ── Trigger.dev scheduled task (runs every hour) ──────────────────────────────

export const envoiRappelsRdvTask = schedules.task({
  id: "envoi-rappels-rdv",
  cron: "0 * * * *",
  run: async () => {
    const result = await executerEnvoiRappels()
    return result
  },
})

// ── Trigger.dev one-off task (triggered manually or via API) ──────────────────

export const envoiRappelsRdvManuel = task({
  id: "envoi-rappels-rdv-manuel",
  run: async () => {
    return executerEnvoiRappels()
  },
})
