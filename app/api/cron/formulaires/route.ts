import { NextResponse } from "next/server"
import { executerEnvoiFormulaires } from "@/jobs/envoi-formulaires"

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }
  try {
    const result = await executerEnvoiFormulaires()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/formulaires]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
