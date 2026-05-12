import type { ReactElement } from "react"
import { db } from "@/lib/prisma"
import { resend, FROM } from "@/lib/resend"
import type { TypeCommunication } from "@prisma/client"

interface SendEmailOptions {
  orgId: string
  patientId: string
  rendezvousId?: string
  type: TypeCommunication
  to: string
  sujet: string
  template: ReactElement
}

export async function envoyerEtLoggerEmail(opts: SendEmailOptions): Promise<void> {
  const { orgId, patientId, rendezvousId, type, to, sujet, template } = opts

  const comm = await db.communication.create({
    data: {
      orgId,
      patientId,
      rendezvousId: rendezvousId ?? null,
      type,
      canal: "COURRIEL",
      statut: "EN_ATTENTE",
      sujet,
      contenu: sujet,
    },
  })

  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM.name} <${FROM.email}>`,
      to,
      subject: sujet,
      react: template,
    })
    if (error || !data) throw new Error(error?.message ?? "Resend error")
    await db.communication.update({
      where: { id: comm.id },
      data: { statut: "ENVOYE", resendId: data.id, envoyeLe: new Date() },
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