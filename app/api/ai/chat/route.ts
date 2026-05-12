import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/prisma"
import OpenAI from "openai"
import { startOfDay, endOfDay, format, subDays } from "date-fns"
import { fr } from "date-fns/locale"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Tool = OpenAI.Chat.Completions.ChatCompletionTool
type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "rdvs_du_jour",
      description: "Récupère tous les rendez-vous d'aujourd'hui avec le statut de confirmation.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "non_confirmes",
      description: "Liste les patients qui n'ont pas encore confirmé leur RDV aujourd'hui.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "rechercher_patient",
      description: "Recherche un patient par nom, prénom ou numéro de téléphone.",
      parameters: {
        type: "object",
        properties: { q: { type: "string", description: "Terme de recherche" } },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "statistiques_semaine",
      description: "Retourne les KPIs de la semaine en cours (no-shows, taux de confirmation, etc.).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "rdvs_a_venir",
      description: "Liste les rendez-vous des X prochains jours.",
      parameters: {
        type: "object",
        properties: { jours: { type: "number", description: "Nombre de jours (défaut: 7)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rediger_message_sms",
      description: "Rédige un message SMS professionnel en français pour un patient (rappel, relance, remerciement, etc.).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Type de message (rappel, relance, remerciement, annulation)" },
          contexte: { type: "string", description: "Contexte spécifique du message" },
        },
        required: ["type", "contexte"],
      },
    },
  },
]

async function executeTool(name: string, args: Record<string, unknown>, orgId: string): Promise<string> {
  const now = new Date()

  switch (name) {
    case "rdvs_du_jour": {
      const rdvs = await db.rendezVous.findMany({
        where: {
          orgId,
          dateHeure: { gte: startOfDay(now), lte: endOfDay(now) },
          statut: { notIn: ["ANNULE"] },
        },
        include: {
          patient: { select: { prenom: true, nom: true, telephone: true } },
          praticien: { select: { prenom: true, nom: true } },
        },
        orderBy: { dateHeure: "asc" },
      })
      if (!rdvs.length) return "Aucun rendez-vous aujourd'hui."
      return rdvs.map((r) =>
        `${format(new Date(r.dateHeure), "HH:mm")} — ${r.patient.prenom} ${r.patient.nom} (${r.patient.telephone}) avec ${r.praticien.prenom} ${r.praticien.nom} — Statut: ${r.statut} — ${r.confirmeParPatient ? "Confirmé ✓" : "Non confirmé ⚠"}`
      ).join("\n")
    }

    case "non_confirmes": {
      const rdvs = await db.rendezVous.findMany({
        where: {
          orgId,
          dateHeure: { gte: startOfDay(now), lte: endOfDay(now) },
          statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE", "ARRIVE"] },
          confirmeParPatient: false,
        },
        include: {
          patient: { select: { prenom: true, nom: true, telephone: true } },
          praticien: { select: { prenom: true, nom: true } },
        },
        orderBy: { dateHeure: "asc" },
      })
      if (!rdvs.length) return "Tous les patients ont confirmé leur RDV aujourd'hui."
      return `${rdvs.length} patient(s) non confirmé(s):\n` + rdvs.map((r) =>
        `• ${r.patient.prenom} ${r.patient.nom} — ${format(new Date(r.dateHeure), "HH:mm")} avec ${r.praticien.prenom} ${r.praticien.nom} — Tél: ${r.patient.telephone}`
      ).join("\n")
    }

    case "rechercher_patient": {
      const q = String(args.q ?? "")
      const patients = await db.patient.findMany({
        where: {
          orgId,
          OR: [
            { nom: { contains: q, mode: "insensitive" } },
            { prenom: { contains: q, mode: "insensitive" } },
            { telephone: { contains: q } },
          ],
        },
        select: {
          prenom: true, nom: true, telephone: true, courriel: true, actif: true,
          rendezvous: { select: { dateHeure: true, statut: true }, orderBy: { dateHeure: "desc" }, take: 3 },
        },
        take: 5,
      })
      if (!patients.length) return `Aucun patient trouvé pour "${q}".`
      return patients.map((p) => {
        const dernierRdv = p.rendezvous[0]
        return `${p.prenom} ${p.nom} — ${p.telephone}${p.courriel ? ` / ${p.courriel}` : ""} — ${p.actif ? "Actif" : "Inactif"}${dernierRdv ? ` — Dernier RDV: ${format(new Date(dernierRdv.dateHeure), "d MMM yyyy", { locale: fr })} (${dernierRdv.statut})` : ""}`
      }).join("\n")
    }

    case "statistiques_semaine": {
      const lundi = new Date(now)
      lundi.setDate(now.getDate() - now.getDay() + 1)
      lundi.setHours(0, 0, 0, 0)
      const dimanche = new Date(lundi)
      dimanche.setDate(lundi.getDate() + 6)
      dimanche.setHours(23, 59, 59, 999)

      const [total, noShows, confirmes, avisEnvoyes] = await Promise.all([
        db.rendezVous.count({ where: { orgId, dateHeure: { gte: lundi, lte: dimanche } } }),
        db.rendezVous.count({ where: { orgId, statut: "NO_SHOW", dateHeure: { gte: lundi, lte: dimanche } } }),
        db.rendezVous.count({ where: { orgId, confirmeParPatient: true, dateHeure: { gte: lundi, lte: dimanche } } }),
        db.avisGoogle.count({ where: { orgId, dateEnvoi: { gte: startOfDay(subDays(now, 30)) } } }),
      ])
      const tauxNoShow = total > 0 ? Math.round((noShows / total) * 100) : 0
      const tauxConfirmation = total > 0 ? Math.round((confirmes / total) * 100) : 0
      return `Semaine du ${format(lundi, "d MMM", { locale: fr })} au ${format(dimanche, "d MMM", { locale: fr })}:\n• Total RDV: ${total}\n• No-shows: ${noShows} (${tauxNoShow}%)\n• Confirmés automatiquement: ${confirmes} (${tauxConfirmation}%)\n• Avis Google envoyés ce mois: ${avisEnvoyes}`
    }

    case "rdvs_a_venir": {
      const jours = Math.min(Number(args.jours ?? 7), 30)
      const rdvs = await db.rendezVous.findMany({
        where: {
          orgId,
          dateHeure: { gte: now, lte: new Date(now.getTime() + jours * 86400000) },
          statut: { notIn: ["ANNULE", "NO_SHOW"] },
        },
        include: {
          patient: { select: { prenom: true, nom: true } },
          praticien: { select: { prenom: true, nom: true } },
        },
        orderBy: { dateHeure: "asc" },
        take: 20,
      })
      if (!rdvs.length) return `Aucun RDV prévu dans les ${jours} prochains jours.`
      return rdvs.map((r) =>
        `${format(new Date(r.dateHeure), "EEE d MMM 'à' HH:mm", { locale: fr })} — ${r.patient.prenom} ${r.patient.nom} avec ${r.praticien.prenom} ${r.praticien.nom} — ${r.confirmeParPatient ? "Confirmé" : "Non confirmé"}`
      ).join("\n")
    }

    case "rediger_message_sms":
      return `[Voici un brouillon de message SMS ${args.type}]\nContexte: ${args.contexte}\n\n(L'IA va rédiger le message dans sa réponse finale)`

    default:
      return "Outil inconnu."
  }
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const org = await db.organisation.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true, nom: true, type: true },
  })
  if (!org) return Response.json({ error: "Organisation introuvable" }, { status: 404 })

  const { messages } = (await req.json()) as { messages: Message[] }

  const systemPrompt = `Tu es l'assistant IA de ${org.nom}, une clinique de santé privée québécoise (type: ${org.type}).
Tu aides le personnel (réceptionnistes, praticiens, gestionnaires) à gérer les rendez-vous et les patients.
Réponds en français québécois, de façon concise et professionnelle. Sois direct et utile.
Aujourd'hui: ${format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}.
Utilise les outils disponibles pour accéder aux données réelles avant de répondre.
Si on te demande de rédiger un message SMS, utilise l'outil rediger_message_sms puis rédige le message complet dans ta réponse.`

  const allMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ]

  // First completion (may include tool calls)
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: allMessages,
    tools,
    tool_choice: "auto",
    max_tokens: 1000,
  })

  const msg = response.choices[0].message

  // If tool calls, execute them and do a second pass
  if (msg.tool_calls?.length) {
    const toolResults: Message[] = []
    for (const call of msg.tool_calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (call as any).function as { name: string; arguments: string }
      const args = JSON.parse(fn.arguments || "{}") as Record<string, unknown>
      const result = await executeTool(fn.name, args, org.id)
      toolResults.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      })
    }

    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [...allMessages, msg, ...toolResults],
      max_tokens: 1000,
    })

    return Response.json({ content: finalResponse.choices[0].message.content })
  }

  return Response.json({ content: msg.content })
}
