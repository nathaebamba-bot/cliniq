import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

  const org = await db.organisation.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } })
  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 })

  const patients = await db.patient.findMany({
    where: { orgId: org.id, actif: true },
    orderBy: { nom: "asc" },
    select: {
      prenom: true, nom: true, dateNaissance: true, sexe: true,
      telephone: true, courriel: true, langue: true,
      consentementSMS: true, consentementCourriel: true,
      createdAt: true,
    },
  })

  const headers = ["Prenom", "Nom", "Date naissance", "Sexe", "Telephone", "Courriel", "Langue", "Consentement SMS", "Consentement courriel", "Cree le"]
  const rows = patients.map((p) => [
    p.prenom,
    p.nom,
    p.dateNaissance ? new Date(p.dateNaissance).toLocaleDateString("fr-CA") : "",
    p.sexe ?? "",
    p.telephone,
    p.courriel ?? "",
    p.langue,
    p.consentementSMS ? "Oui" : "Non",
    p.consentementCourriel ? "Oui" : "Non",
    new Date(p.createdAt).toLocaleDateString("fr-CA"),
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patients-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
