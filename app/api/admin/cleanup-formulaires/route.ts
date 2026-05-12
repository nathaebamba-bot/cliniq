import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"

// POST /api/admin/cleanup-formulaires
// One-time cleanup: deletes duplicate/orphaned FormulaireReponse records.
// Keeps only the most recent pending record per RDV, and always keeps completed ones.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  // Find all rendezvousIds that have more than one pending (non-completed) FormulaireReponse
  const allPending = await db.formulaireReponse.findMany({
    where: { completeLe: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, rendezvousId: true, createdAt: true },
  })

  // Group by rendezvousId — keep the newest, delete the rest
  const byRdv = new Map<string | null, typeof allPending>()
  for (const r of allPending) {
    const key = r.rendezvousId ?? `no-rdv-${r.id}`
    if (!byRdv.has(key)) byRdv.set(key, [])
    byRdv.get(key)!.push(r)
  }

  const toDelete: string[] = []
  for (const [, records] of byRdv) {
    if (records.length > 1) {
      // Keep index 0 (newest due to orderBy desc), delete the rest
      toDelete.push(...records.slice(1).map((r) => r.id))
    }
  }

  if (toDelete.length === 0) return NextResponse.json({ deleted: 0 })

  await db.formulaireReponse.deleteMany({ where: { id: { in: toDelete } } })
  return NextResponse.json({ deleted: toDelete.length })
}
