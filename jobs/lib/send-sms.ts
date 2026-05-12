import { db } from "@/lib/prisma"
import { envoyerSMS } from "@/lib/twilio"
import type { CanalCommunication, TypeCommunication } from "@prisma/client"

interface SendSMSOptions {
  orgId: string
  patientId: string
  rendezvousId?: string
  type: TypeCommunication
  corps: string
  telephone: string
}

export async function envoyerEtLogger(opts: SendSMSOptions): Promise<void> {
  const { orgId, patientId, rendezvousId, type, corps, telephone } = opts

  const comm = await db.communication.create({
    data: {
      orgId,
      patientId,
      rendezvousId: rendezvousId ?? null,
      type,
      canal: "SMS" as CanalCommunication,
      statut: "EN_ATTENTE",
      contenu: corps,
    },
  })

  try {
    const sid = await envoyerSMS(telephone, corps)
    await db.communication.update({
      where: { id: comm.id },
      data: { statut: "ENVOYE", twilioSid: sid, envoyeLe: new Date() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.communication.update({
      where: { id: comm.id },
      data: { statut: "ECHEC", erreur: message },
    })
    throw err
  }
}
