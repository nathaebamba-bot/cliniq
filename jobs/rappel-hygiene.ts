import { schedules } from "@trigger.dev/sdk/v3"
import { subMonths } from "date-fns"
import { db } from "@/lib/prisma"
import { interpolerMessage } from "@/lib/utils"
import { envoyerEtLogger } from "./lib/send-sms"

export async function executerRappelHygiene(): Promise<{ envoyes: number; ignores: number }> {
  let envoyes = 0
  let ignores = 0

  const orgs = await db.organisation.findMany({
    where: { parametres: { hygieneActif: true } },
    include: { parametres: true },
  })

  for (const org of orgs) {
    const params = org.parametres!
    const seuil = subMonths(new Date(), params.hygieneDelaiMois)

    // Find patients whose last appointment was > hygieneDelaiMois ago
    // and who haven't received a hygiene reminder recently
    const patients = await db.patient.findMany({
      where: {
        orgId: org.id,
        actif: true,
        consentementSMS: true,
        rendezvous: {
          some: {
            statut: "COMPLETE",
            dateHeure: { lte: seuil },
          },
          none: {
            statut: "COMPLETE",
            dateHeure: { gt: seuil },
          },
        },
        // No hygiene communication sent recently
        communications: {
          none: {
            type: "RAPPEL_HYGIENE",
            createdAt: { gt: seuil },
          },
        },
      },
      take: 100,
    })

    for (const patient of patients) {
      try {
        const corps = interpolerMessage(
          patient.langue === "EN"
            ? `Hello {{prenom}}, it's been a while since your last visit! Don't forget to schedule your routine checkup. Call us anytime.`
            : `Bonjour {{prenom}}, cela fait un moment depuis votre dernière visite! N'oubliez pas de planifier votre bilan de routine. Appelez-nous!`,
          { prenom: patient.prenom, clinique: org.nom }
        )

        await envoyerEtLogger({
          orgId: org.id,
          patientId: patient.id,
          type: "RAPPEL_HYGIENE",
          corps,
          telephone: patient.telephone,
        })

        envoyes++
      } catch {
        ignores++
      }
    }
  }

  return { envoyes, ignores }
}

export const rappelHygieneTask = schedules.task({
  id: "rappel-hygiene",
  cron: "0 9 * * *",
  run: async () => executerRappelHygiene(),
})
