import { NextResponse } from "next/server"
import { executerEnvoiRappels } from "@/jobs/envoi-rappels-rdv"
import { db } from "@/lib/prisma"
import { addHours, subHours } from "date-fns"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const [rappelsResult, appelsResult] = await Promise.all([
      executerEnvoiRappels(),
      declencherAppelsAutomatiques(),
    ])
    return NextResponse.json({ ok: true, ...rappelsResult, appelsAutomatiques: appelsResult })
  } catch (err) {
    console.error("[cron/rappels]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

async function declencherAppelsAutomatiques() {
  const maintenant = new Date()
  const dans48h = addHours(maintenant, 48)
  const il2h = subHours(maintenant, 2)

  // Find RDVs in the next 48h that:
  // - Got a SMS reminder > 2h ago (rappel48hEnvoye or rappel24hEnvoye)
  // - Still not confirmed
  // - Not already called (no VOCAL communication in the last 24h)
  const rdvsAAppeler = await db.rendezVous.findMany({
    where: {
      dateHeure: { gte: maintenant, lte: dans48h },
      statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE", "ARRIVE"] },
      confirmeParPatient: false,
      OR: [{ rappel48hEnvoye: true }, { rappel24hEnvoye: true }],
      communications: {
        none: { canal: "VOCAL", createdAt: { gte: subHours(maintenant, 24) } },
      },
    },
    include: {
      patient: { select: { telephone: true, consentementSMS: true } },
    },
    take: 20,
  })

  // Filter: only call if the SMS was sent > 2h ago (use updatedAt as proxy)
  const aAppeler = rdvsAAppeler.filter(
    (r) => new Date(r.updatedAt) <= il2h && r.patient.telephone
  )

  let appelsDeclenches = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!appUrl || !accountSid || !authToken || !from) return { appelsDeclenches: 0 }

  for (const rdv of aAppeler) {
    try {
      const params = new URLSearchParams({
        To: rdv.patient.telephone!,
        From: from,
        Url: `${appUrl}/api/webhooks/voice?rdvId=${rdv.id}`,
        StatusCallback: `${appUrl}/api/webhooks/voice/status?rdvId=${rdv.id}`,
        StatusCallbackMethod: "POST",
        MachineDetection: "Enable",
      })
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      )
      if (res.ok) {
        const data = await res.json() as { sid: string }
        await db.communication.create({
          data: {
            orgId: rdv.orgId,
            patientId: rdv.patientId,
            rendezvousId: rdv.id,
            type: "RAPPEL_RDV",
            canal: "VOCAL",
            statut: "ENVOYE",
            contenu: "Appel vocal automatique (pas de réponse au SMS)",
            twilioSid: data.sid,
            envoyeLe: new Date(),
          },
        })
        appelsDeclenches++
      }
    } catch {
      // Continue with next
    }
  }

  return { appelsDeclenches }
}
