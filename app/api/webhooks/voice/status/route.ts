import { db } from "@/lib/prisma"

// Twilio calls this when the call status changes (completed, failed, busy, no-answer)
export async function POST(req: Request) {
  const body = await req.formData()
  const rdvId = new URL(req.url).searchParams.get("rdvId")
  const callStatus = body.get("CallStatus") as string | null
  const callSid = body.get("CallSid") as string | null

  if (!rdvId || !callStatus) return new Response("ok", { status: 200 })

  // Update the communication log with final status
  if (callSid) {
    const statut = callStatus === "completed" ? "DELIVRE"
      : callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" ? "ECHEC"
      : "ENVOYE"

    await db.communication.updateMany({
      where: { twilioSid: callSid },
      data: { statut, erreur: ["busy", "no-answer", "failed"].includes(callStatus) ? `Statut Twilio: ${callStatus}` : null },
    })
  }

  return new Response("ok", { status: 200 })
}
