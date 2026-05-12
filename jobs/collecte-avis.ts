import { task, schedules } from "@trigger.dev/sdk/v3"
import { subHours } from "date-fns"
import { db } from "@/lib/prisma"
import { estDansPlageHoraire, interpolerMessage } from "@/lib/utils"
import { envoyerEtLogger } from "./lib/send-sms"

export async function executerCollecteAvis(): Promise<{ envoyes: number; ignores: number }> {
  let envoyes = 0
  let ignores = 0

  const orgs = await db.organisation.findMany({
    where: { parametres: { avisActif: true } },
    include: { parametres: true },
  })

  for (const org of orgs) {
    const params = org.parametres!
    if (!params.avisLienGoogle) { ignores++; continue }

    const heureOk = estDansPlageHoraire(
      params.heureDebutEnvoi,
      params.heureFinEnvoi,
      params.fuseauHoraire
    )
    if (!heureOk) { ignores++; continue }

    const seuil = subHours(new Date(), params.avisDelaiApresRdv)

    const rdvs = await db.rendezVous.findMany({
      where: {
        orgId: org.id,
        statut: "COMPLETE",
        avisEnvoye: false,
        dateHeure: { lte: seuil },
      },
      include: { patient: true },
    })

    for (const rdv of rdvs) {
      if (!rdv.patient.consentementSMS) { ignores++; continue }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq.app"
      let avisRecord: { id: string } | null = null

      try {
        avisRecord = await db.avisGoogle.create({
          data: {
            orgId: org.id,
            patientId: rdv.patient.id,
            lienEnvoye: true,
            dateEnvoi: new Date(),
          },
        })

        const lienSuivi = `${appUrl}/api/avis/click/${avisRecord.id}`
        const corps = interpolerMessage(
          rdv.patient.langue === "EN"
            ? `Hello {{prenom}}, thank you for your visit! Your review helps us a lot: {{lien}}`
            : params.avisMessageSMS,
          {
            prenom: rdv.patient.prenom,
            nom: rdv.patient.nom,
            clinique: org.nom,
            lien: lienSuivi,
          }
        )

        await envoyerEtLogger({
          orgId: org.id,
          patientId: rdv.patient.id,
          rendezvousId: rdv.id,
          type: "COLLECTE_AVIS",
          corps,
          telephone: rdv.patient.telephone,
        })

        await db.rendezVous.update({ where: { id: rdv.id }, data: { avisEnvoye: true } })
        envoyes++
      } catch (err) {
        // Roll back the AvisGoogle record so the next run retries cleanly
        if (avisRecord) {
          await db.avisGoogle.delete({ where: { id: avisRecord.id } }).catch(() => null)
        }
        console.error(`collecte-avis: échec pour RDV ${rdv.id} (patient ${rdv.patient.id}):`, err)
        ignores++
      }
    }
  }

  return { envoyes, ignores }
}

export const collecteAvisTask = schedules.task({
  id: "collecte-avis-post-rdv",
  cron: "0 * * * *",
  run: async () => executerCollecteAvis(),
})
