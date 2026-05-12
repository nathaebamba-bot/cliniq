import { task, schedules } from "@trigger.dev/sdk/v3"
import { subDays } from "date-fns"
import { db } from "@/lib/prisma"
import { interpolerMessage } from "@/lib/utils"
import { envoyerEtLogger } from "./lib/send-sms"

export async function executerRelanceTraitements(): Promise<{ envoyes: number }> {
  let envoyes = 0

  const orgs = await db.organisation.findMany({
    where: { parametres: { relanceActif: true } },
    include: { parametres: true },
  })

  for (const org of orgs) {
    const params = org.parametres!
    const seuil = subDays(new Date(), params.relanceDelaiJours)

    const rdvs = await db.rendezVous.findMany({
      where: {
        orgId: org.id,
        traitementComplete: false,
        relanceEnvoyee: false,
        statut: "COMPLETE",
        dateHeure: { lte: seuil },
      },
      include: { patient: true, praticien: true },
    })

    for (const rdv of rdvs) {
      if (!rdv.patient.consentementSMS) continue
      try {
        const corps = interpolerMessage(
          rdv.patient.langue === "EN"
            ? `Hello {{prenom}}, we noticed your treatment with {{praticien}} may not be complete. Would you like to schedule a follow-up? Call us at {{clinique}}.`
            : `Bonjour {{prenom}}, nous remarquons que votre traitement avec {{praticien}} pourrait ne pas être terminé. Souhaitez-vous planifier un suivi ? Contactez {{clinique}}.`,
          {
            prenom: rdv.patient.prenom,
            praticien: `${rdv.praticien.prenom} ${rdv.praticien.nom}`,
            clinique: org.nom,
          }
        )
        await envoyerEtLogger({
          orgId: org.id,
          patientId: rdv.patient.id,
          rendezvousId: rdv.id,
          type: "RELANCE_TRAITEMENT",
          corps,
          telephone: rdv.patient.telephone,
        })
        await db.rendezVous.update({
          where: { id: rdv.id },
          data: { relanceEnvoyee: true },
        })
        envoyes++
      } catch { /* continue */ }
    }
  }

  return { envoyes }
}

export const relanceTraitementsTask = schedules.task({
  id: "relance-traitements",
  cron: "0 9 * * *",
  run: async () => executerRelanceTraitements(),
})
