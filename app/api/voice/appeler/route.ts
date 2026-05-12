import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/prisma"

export async function POST(req: Request) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { rdvId } = (await req.json()) as { rdvId: string }
  if (!rdvId) return Response.json({ error: "rdvId requis" }, { status: 400 })

  const org = await db.organisation.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
  if (!org) return Response.json({ error: "Organisation introuvable" }, { status: 404 })

  const rdv = await db.rendezVous.findFirst({
    where: { id: rdvId, orgId: org.id },
    include: { patient: { select: { telephone: true, prenom: true } } },
  })
  if (!rdv) return Response.json({ error: "RDV introuvable" }, { status: 404 })
  if (!rdv.patient.telephone) return Response.json({ error: "Patient sans numéro de téléphone" }, { status: 400 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    return Response.json({ error: "Twilio non configuré" }, { status: 503 })
  }

  const twimlUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/voice?rdvId=${rdvId}`
  const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/voice/status?rdvId=${rdvId}`

  const params = new URLSearchParams({
    To: rdv.patient.telephone,
    From: from,
    Url: twimlUrl,
    StatusCallback: statusUrl,
    StatusCallbackMethod: "POST",
    MachineDetection: "Enable",
  })

  const twilioRes = await fetch(
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

  const data = await twilioRes.json() as { sid?: string; message?: string }

  if (!twilioRes.ok) {
    return Response.json({ error: data.message ?? "Erreur Twilio" }, { status: 502 })
  }

  // Log the call attempt
  await db.communication.create({
    data: {
      orgId: org.id,
      patientId: rdv.patientId,
      rendezvousId: rdvId,
      type: "RAPPEL_RDV",
      canal: "VOCAL",
      statut: "ENVOYE",
      contenu: `Appel vocal initié — SID: ${data.sid}`,
      twilioSid: data.sid,
      envoyeLe: new Date(),
    },
  })

  return Response.json({ success: true, callSid: data.sid })
}
