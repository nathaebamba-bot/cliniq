import { db } from "@/lib/prisma"

// Twilio sends the patient's DTMF digit here
export async function POST(req: Request) {
  const body = await req.formData()
  const rdvId = new URL(req.url).searchParams.get("rdvId")
  const digit = body.get("Digits") as string | null

  if (!rdvId) return twiml(`<Say language="fr-CA" voice="Polly.Chantal">Erreur. Au revoir.</Say>`)

  const rdv = await db.rendezVous.findUnique({
    where: { id: rdvId },
    select: { id: true, patient: { select: { prenom: true } } },
  })
  if (!rdv) return twiml(`<Say language="fr-CA" voice="Polly.Chantal">Erreur. Au revoir.</Say>`)

  if (digit === "1") {
    await db.rendezVous.update({
      where: { id: rdvId },
      data: { confirmeParPatient: true, confirmeLeDate: new Date() },
    })
    await db.communication.create({
      data: {
        orgId: (await db.rendezVous.findUnique({ where: { id: rdvId }, select: { orgId: true } }))!.orgId,
        patientId: (await db.rendezVous.findUnique({ where: { id: rdvId }, select: { patientId: true } }))!.patientId,
        rendezvousId: rdvId,
        type: "CONFIRMATION_RDV",
        canal: "VOCAL",
        statut: "REPONDU",
        contenu: "Appel vocal automatique — confirmation par touche 1",
        reponsePatient: "1 (Confirmé)",
        reponseRecueLe: new Date(),
        envoyeLe: new Date(),
      },
    })
    return twiml(`<Say language="fr-CA" voice="Polly.Chantal">Merci ${rdv.patient.prenom}, votre rendez-vous est confirmé. À bientôt!</Say>`)
  }

  if (digit === "2") {
    await db.rendezVous.update({
      where: { id: rdvId },
      data: { statut: "ANNULE" },
    })
    await db.communication.create({
      data: {
        orgId: (await db.rendezVous.findUnique({ where: { id: rdvId }, select: { orgId: true } }))!.orgId,
        patientId: (await db.rendezVous.findUnique({ where: { id: rdvId }, select: { patientId: true } }))!.patientId,
        rendezvousId: rdvId,
        type: "CONFIRMATION_RDV",
        canal: "VOCAL",
        statut: "REPONDU",
        contenu: "Appel vocal automatique — annulation par touche 2",
        reponsePatient: "2 (Annulé)",
        reponseRecueLe: new Date(),
        envoyeLe: new Date(),
      },
    })
    return twiml(`<Say language="fr-CA" voice="Polly.Chantal">Votre rendez-vous a été annulé. N'hésitez pas à nous rappeler pour replanifier. Au revoir!</Say>`)
  }

  return twiml(`<Say language="fr-CA" voice="Polly.Chantal">Touche non reconnue. Merci de nous rappeler directement. Au revoir.</Say>`)
}

function twiml(body: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  )
}
