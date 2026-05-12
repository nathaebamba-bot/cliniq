import { db } from "@/lib/prisma"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

export async function POST(req: Request) {
  const rdvId = new URL(req.url).searchParams.get("rdvId")

  if (!rdvId) return errorTwiml()

  try {
    const rdv = await db.rendezVous.findUnique({
      where: { id: rdvId },
      include: {
        patient: { select: { prenom: true } },
        praticien: { select: { prenom: true, nom: true } },
        organisation: { select: { nom: true, telephone: true } },
      },
    })

    if (!rdv) return errorTwiml()

    const dateStr = format(new Date(rdv.dateHeure), "EEEE d MMMM", { locale: fr })
    const h = new Date(rdv.dateHeure)
    const heures = h.getHours()
    const minutes = h.getMinutes()
    const heureStr = minutes === 0 ? `${heures} heures` : `${heures} heures ${minutes}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq-beige.vercel.app"
    const actionUrl = `${appUrl}/api/webhooks/voice/reponse?rdvId=${rdvId}`

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${actionUrl}" method="POST" timeout="10">
    <Say language="fr-CA" voice="Polly.Chantal">Bonjour ${escapeXml(rdv.patient.prenom)}. Ceci est un rappel automatique de ${escapeXml(rdv.organisation.nom)}. Vous avez un rendez-vous le ${dateStr} à ${heureStr} avec ${escapeXml(rdv.praticien.prenom)} ${escapeXml(rdv.praticien.nom)}. Appuyez sur le 1 pour confirmer votre présence. Appuyez sur le 2 pour annuler.</Say>
  </Gather>
  <Say language="fr-CA" voice="Polly.Chantal">Nous n'avons pas reçu de réponse. Merci de nous rappeler au ${escapeXml(rdv.organisation.telephone ?? "la clinique")}. Au revoir.</Say>
</Response>`

    return new Response(xml, { headers: { "Content-Type": "text/xml" } })
  } catch (err) {
    console.error("[voice/route]", err)
    return errorTwiml()
  }
}

function errorTwiml() {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA" voice="Polly.Chantal">Désolée, une erreur est survenue. Veuillez rappeler la clinique directement. Au revoir.</Say></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  )
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
