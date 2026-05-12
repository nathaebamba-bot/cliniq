import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { validerSignatureTwilio, envoyerSMS } from "@/lib/twilio"
import { parserReponseSMS } from "@/lib/utils"
import { rateLimitWebhook } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rl = rateLimitWebhook(ip)
  if (!rl.success) {
    return new NextResponse("Too Many Requests", { status: 429 })
  }

  // 1. Parse form-encoded Twilio payload
  const body = await req.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  // 2. Always validate Twilio signature (skip only if explicitly in local dev without the secret)
  const twilioSecret = process.env.TWILIO_AUTH_TOKEN
  if (twilioSecret) {
    const signature = req.headers.get("X-Twilio-Signature") ?? ""
    const url = process.env.NEXT_PUBLIC_APP_URL + "/api/webhooks/twilio"
    const valid = validerSignatureTwilio(signature, url, params)
    if (!valid) {
      return new NextResponse("Signature invalide", { status: 403 })
    }
  }

  const from = params["From"] // patient's number
  const to = params["To"]     // clinic's Twilio number
  const body2 = (params["Body"] ?? "").slice(0, 1000) // cap input length

  if (!from || !to) {
    return new NextResponse("Paramètres manquants", { status: 400 })
  }

  // Validate phone number format (E.164)
  if (!/^\+\d{7,15}$/.test(from) || !/^\+\d{7,15}$/.test(to)) {
    return new NextResponse("Format de numéro invalide", { status: 400 })
  }

  // 3. Find org by Twilio phone number
  const integration = await db.integration.findFirst({
    where: { type: "TWILIO", actif: true },
    include: { organisation: { include: { parametres: true } } },
  })

  const org = integration?.organisation ?? await db.organisation.findFirst({
    where: { telephone: to },
    include: { parametres: true },
  })

  if (!org) return twimlResponse("")

  // 4. Find patient by phone number
  const patient = await db.patient.findFirst({
    where: { orgId: org.id, telephone: from },
  })

  if (!patient) {
    return twimlResponse("")
  }

  // 5. Find the most recent pending rendez-vous
  const rdv = await db.rendezVous.findFirst({
    where: {
      orgId: org.id,
      patientId: patient.id,
      statut: { in: ["PLANIFIE", "CONFIRME"] },
      dateHeure: { gte: new Date() },
    },
    orderBy: { dateHeure: "asc" },
  })

  // 6. Log the incoming message
  await db.communication.create({
    data: {
      orgId: org.id,
      patientId: patient.id,
      rendezvousId: rdv?.id ?? null,
      type: "REPONSE_ENTRANTE",
      canal: "SMS",
      statut: "REPONDU",
      contenu: body2,
      reponsePatient: body2,
      reponseRecueLe: new Date(),
      envoyeLe: new Date(),
    },
  })

  // 7. Check if this is a waiting list response (patient was notified in last 30 min)
  const trenteMinsAgo = new Date(Date.now() - 30 * 60 * 1000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attenteEntry = await (db as any).listeAttente.findFirst({
    where: { orgId: org.id, patientId: patient.id, statut: "NOTIFIE", notifieLe: { gte: trenteMinsAgo } },
    orderBy: { notifieLe: "desc" },
  })

  const action = parserReponseSMS(body2)
  let reponseClinique = ""

  if (attenteEntry) {
    if (action === "CONFIRMER" && attenteEntry.creneauPropose) {
      const praticienId = attenteEntry.praticienId ?? (
        await db.praticien.findFirst({ where: { orgId: org.id, actif: true }, select: { id: true } })
      )?.id
      if (praticienId) {
        await db.rendezVous.create({
          data: {
            orgId: org.id, patientId: patient.id, praticienId,
            dateHeure: attenteEntry.creneauPropose,
            dureeMinutes: attenteEntry.dureeMinutes,
            typeRdv: attenteEntry.typeRdv ?? undefined,
            statut: "CONFIRME", confirmeParPatient: true, confirmeLeDate: new Date(),
          },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).listeAttente.update({ where: { id: attenteEntry.id }, data: { statut: "CONVERTI" } })
        const d = new Date(attenteEntry.creneauPropose)
        const dateStr = d.toLocaleDateString("fr-CA")
        const heureStr = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
        reponseClinique = patient.langue === "EN"
          ? `Your appointment is confirmed for ${dateStr} at ${heureStr}. See you then!`
          : `Parfait! Votre rendez-vous est confirmé le ${dateStr} à ${heureStr}. À bientôt!`
      }
    } else {
      // Declined or unclear — put back in queue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).listeAttente.update({
        where: { id: attenteEntry.id },
        data: { statut: "EN_ATTENTE", notifieLe: null, creneauPropose: null },
      })
      reponseClinique = patient.langue === "EN"
        ? `No problem! You remain on the waiting list.`
        : `Pas de problème! Vous restez sur notre liste d'attente.`
    }
  } else if (rdv) {
    if (action === "CONFIRMER") {
      await db.rendezVous.update({
        where: { id: rdv.id },
        data: { confirmeParPatient: true, confirmeLeDate: new Date(), statut: "CONFIRME" },
      })
      reponseClinique = patient.langue === "EN"
        ? `Thank you! Your appointment on ${rdv.dateHeure.toLocaleDateString("en-CA")} at ${rdv.dateHeure.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })} is confirmed. See you soon!`
        : `Merci ! Votre rendez-vous du ${rdv.dateHeure.toLocaleDateString("fr-CA")} à ${rdv.dateHeure.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} est confirmé. À bientôt !`
    } else if (action === "ANNULER") {
      await db.rendezVous.update({ where: { id: rdv.id }, data: { statut: "ANNULE" } })
      reponseClinique = patient.langue === "EN"
        ? `Your appointment has been cancelled. Please call us to reschedule.`
        : `Votre rendez-vous a été annulé. Veuillez nous appeler pour en reprendre un.`
    }
  }

  if (reponseClinique) {
    envoyerSMS(from, reponseClinique).catch(() => { /* fire and forget */ })
  }

  return twimlResponse(reponseClinique)
}

function twimlResponse(message: string) {
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
