import { NextResponse } from "next/server"
import { executerRappelHygiene } from "@/jobs/rappel-hygiene"

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }
  try {
    const result = await executerRappelHygiene()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/hygiene]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
