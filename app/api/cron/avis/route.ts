import { NextResponse } from "next/server"
import { executerCollecteAvis } from "@/jobs/collecte-avis"

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }
  try {
    const result = await executerCollecteAvis()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/avis]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
