import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"

// Redirect + log click on a Google review request
// URL: /api/avis/click/[avisGoogleId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const avis = await db.avisGoogle.findUnique({
    where: { id },
    include: {
      organisation: { select: { parametres: { select: { avisLienGoogle: true } } } },
    },
  })

  if (!avis) {
    return new NextResponse("Lien invalide", { status: 404 })
  }

  // Log the click (idempotent — only set once)
  if (!avis.aClique) {
    await db.avisGoogle.update({
      where: { id },
      data: { aClique: true, dateClick: new Date() },
    })
  }

  const lienGoogle = avis.organisation.parametres?.avisLienGoogle
  if (!lienGoogle) {
    return new NextResponse("Lien Google non configuré", { status: 404 })
  }

  return NextResponse.redirect(lienGoogle)
}
