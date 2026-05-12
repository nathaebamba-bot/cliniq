import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { db } from "@/lib/prisma"

export const runtime = "nodejs"

type ClerkOrgEvent = {
  type: string
  data: {
    id: string
    name: string
    slug?: string
    created_at?: number
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret || secret === "whsec_...") {
    // Webhook not configured — acknowledge without processing
    return NextResponse.json({ received: true })
  }

  const body = await req.text()
  const svixId = req.headers.get("svix-id") ?? ""
  const svixTimestamp = req.headers.get("svix-timestamp") ?? ""
  const svixSignature = req.headers.get("svix-signature") ?? ""

  let event: ClerkOrgEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkOrgEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    if (event.type === "organization.created") {
      const { id: clerkOrgId, name } = event.data

      // Create org + parametres atomically
      await db.organisation.upsert({
        where: { clerkOrgId },
        create: {
          clerkOrgId,
          nom: name,
          type: "AUTRE",
          parametres: {
            create: {}, // all defaults from schema
          },
          automatisations: {
            createMany: {
              data: [
                { nom: "Rappels rendez-vous", type: "RAPPEL_RDV", actif: true, config: {} },
                { nom: "Formulaires anamnèse", type: "FORMULAIRE_ANAMNE", actif: true, config: {} },
                { nom: "Collecte d'avis Google", type: "COLLECTE_AVIS", actif: true, config: {} },
                { nom: "Relances traitements", type: "RELANCE_TRAITEMENT", actif: true, config: {} },
              ],
            },
          },
        },
        update: { nom: name },
      })
    }

    if (event.type === "organization.deleted") {
      const { id: clerkOrgId } = event.data
      // Soft-delete: mark patients as inactive rather than cascade delete
      await db.organisation.updateMany({
        where: { clerkOrgId },
        data: { forfaitExpireA: new Date() },
      })
    }
  } catch (err) {
    console.error("[clerk-webhook]", err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
