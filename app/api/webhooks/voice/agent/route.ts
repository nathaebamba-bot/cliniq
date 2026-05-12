import { db } from "@/lib/prisma"

const VOICE = "Polly.Gabrielle-Neural"

export async function POST(req: Request) {
  const body = await req.formData()
  const callerPhone = (body.get("From") as string | null) ?? ""
  const toPhone = (body.get("To") as string | null) ?? ""

  let orgName = "la clinique"
  let orgId = ""

  try {
    // Try by called Twilio number
    const digits = toPhone.replace(/\D/g, "")
    if (digits) {
      const org = await db.organisation.findFirst({
        where: {
          OR: [
            { telephone: toPhone },
            { telephone: `+${digits}` },
            { telephone: digits },
            { telephone: digits.slice(-10) },
          ],
        },
        select: { id: true, nom: true },
      })
      if (org) { orgId = org.id; orgName = org.nom }
    }

    // Fallback: look up by TWILIO_PHONE_NUMBER env var
    if (!orgId && process.env.TWILIO_PHONE_NUMBER) {
      const tw = process.env.TWILIO_PHONE_NUMBER
      const org = await db.organisation.findFirst({
        where: { OR: [{ telephone: tw }, { telephone: tw.replace("+1", "") }, { telephone: tw.slice(-10) }] },
        select: { id: true, nom: true },
      })
      if (org) { orgId = org.id; orgName = org.nom }
    }

    // Last resort: first org in DB
    if (!orgId) {
      const org = await db.organisation.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, nom: true } })
      if (org) { orgId = org.id; orgName = org.nom }
    }
  } catch { /* use defaults */ }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq-beige.vercel.app"
  const conv = encodeURIComponent(btoa("[]"))
  const caller = encodeURIComponent(callerPhone)
  const actionUrl = `${appUrl}/api/webhooks/voice/agent/parler?orgId=${orgId}&amp;caller=${caller}&amp;conv=${conv}`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" language="fr-CA" speechTimeout="3" timeout="12">
    <Say language="fr-CA" voice="${VOICE}">Bonjour et bienvenue a ${escapeXml(orgName)}! Je suis Sophie, l'assistante virtuelle. Comment puis-je vous aider aujourd'hui?</Say>
  </Gather>
  <Say language="fr-CA" voice="${VOICE}">Je n'ai pas entendu votre reponse. N'hesitez pas a rappeler. Bonne journee!</Say>
</Response>`

  return new Response(xml, { headers: { "Content-Type": "text/xml" } })
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
