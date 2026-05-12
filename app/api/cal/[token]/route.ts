import { type NextRequest, NextResponse } from "next/server"
import { addMinutes, format } from "date-fns"
import { db } from "@/lib/prisma"

function fmtICS(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function escapeICS(str: string) {
  return str.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n")
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const parametres = await db.parametresClinique.findUnique({
    where: { calendarToken: token },
    include: {
      organisation: {
        select: { id: true, nom: true },
      },
    },
  })

  if (!parametres) {
    return new NextResponse("Lien de calendrier invalide.", { status: 404 })
  }

  const orgId = parametres.organisation.id
  const orgNom = parametres.organisation.nom
  const now = new Date()
  const past = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const future = new Date(now.getFullYear(), now.getMonth() + 6, 0)

  const rdvs = await db.rendezVous.findMany({
    where: {
      orgId,
      statut: { notIn: ["ANNULE"] },
      dateHeure: { gte: past, lte: future },
    },
    include: {
      patient: { select: { prenom: true, nom: true } },
      praticien: { select: { prenom: true, nom: true } },
    },
    orderBy: { dateHeure: "asc" },
  })

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Cliniq//${escapeICS(orgNom)}//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(orgNom)}`,
    "X-WR-TIMEZONE:America/Toronto",
    "X-WR-CALDESC:Rendez-vous Cliniq",
  ]

  for (const rdv of rdvs) {
    const debut = new Date(rdv.dateHeure)
    const fin = addMinutes(debut, rdv.dureeMinutes)
    const patientNom = `${rdv.patient.prenom} ${rdv.patient.nom}`
    const praticienNom = `${rdv.praticien.prenom} ${rdv.praticien.nom}`
    const titre = rdv.typeRdv
      ? `${escapeICS(rdv.typeRdv)} — ${escapeICS(patientNom)}`
      : `RDV — ${escapeICS(patientNom)}`
    const description = `Patient: ${escapeICS(patientNom)}\\nPraticien: ${escapeICS(praticienNom)}${rdv.notes ? `\\nNotes: ${escapeICS(rdv.notes)}` : ""}`

    lines.push(
      "BEGIN:VEVENT",
      `UID:${rdv.id}@cliniq.app`,
      `DTSTAMP:${fmtICS(now)}`,
      `DTSTART:${fmtICS(debut)}`,
      `DTEND:${fmtICS(fin)}`,
      `SUMMARY:${titre}`,
      `DESCRIPTION:${description}`,
      `STATUS:${rdv.statut === "COMPLETE" ? "COMPLETED" : rdv.statut === "NO_SHOW" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT"
    )
  }

  lines.push("END:VCALENDAR")

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="cliniq-${orgId}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
