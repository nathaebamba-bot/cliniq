import { db } from "@/lib/prisma"
import OpenAI from "openai"
import { format, addDays } from "date-fns"
import { fr } from "date-fns/locale"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const VOICE = "Polly.Gabrielle-Neural"

type Msg = { role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string }
type OAIMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam

function tzOffsetMs(tz: string): number {
  const d = new Date()
  const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" })
  const tzStr = d.toLocaleString("en-US", { timeZone: tz })
  return new Date(utcStr).getTime() - new Date(tzStr).getTime()
}

function nowInTz(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]))
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute }
}

function parseLocalIso(isoStr: string, tz: string): Date {
  const clean = isoStr.trim()
  if (clean.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(clean)) return new Date(clean)
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return new Date(clean)
  const [, y, mo, d, h, mi] = match.map(Number)
  const localMs = new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
  return new Date(localMs + tzOffsetMs(tz))
}

type Slot = { display: string; localIso: string; utcDate: Date }

function getAvailableSlots(
  rdvsExistants: { dateHeure: Date; dureeMinutes: number }[],
  heureDebut: number, heureFin: number, tz: string,
  maxPerDay = 3, maxDays = 5
): Slot[] {
  const slots: Slot[] = []
  const { year, month, day, hour, minute } = nowInTz(tz)
  const offsetMs = tzOffsetMs(tz)
  const slotsPerDay: Record<string, number> = {}
  let daysWithSlots = 0

  for (let dayOffset = 0; dayOffset <= 28 && daysWithSlots < maxDays; dayOffset++) {
    const d = new Date(year, month - 1, day + dayOffset)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue

    const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day + dayOffset).padStart(2, "0")}`
    let addedThisDay = 0

    for (let h = heureDebut; h < heureFin; h++) {
      if (dayOffset === 0 && (h < hour || (h === hour && minute >= 30))) continue
      if ((slotsPerDay[dayKey] ?? 0) >= maxPerDay) break

      const localMs = new Date(year, month - 1, day + dayOffset, h, 0, 0, 0).getTime()
      const utcDate = new Date(localMs + offsetMs)

      const overlaps = rdvsExistants.some((r) => {
        const s = r.dateHeure.getTime()
        const e = s + r.dureeMinutes * 60000
        return utcDate.getTime() < e && utcDate.getTime() + 3600000 > s
      })
      if (overlaps) continue

      const localIso = `${year}-${String(month).padStart(2, "0")}-${String(day + dayOffset).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`
      const display = utcDate.toLocaleString("fr-CA", {
        timeZone: tz, weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", hour12: false,
      })
      slots.push({ display, localIso, utcDate })
      slotsPerDay[dayKey] = (slotsPerDay[dayKey] ?? 0) + 1
      addedThisDay++
    }
    if (addedThisDay > 0) daysWithSlots++
  }
  return slots
}

// Treatment billing codes by category (for insurance guidance)
const CODES_FACTURATION: Record<string, string> = {
  "nettoyage": "11110 (Prophylaxie), 01202 (Exam), 02144 (Radiographies)",
  "nettoyage dentaire": "11110 (Prophylaxie), 01202 (Exam)",
  "blanchiment": "09970 (Blanchiment)",
  "couronne": "27310–27390 (Couronne)",
  "extraction": "71101–71240 (Extraction)",
  "invisalign": "81010–81090 (Orthodontie), 81010 (Consult ortho)",
  "orthodontie": "81010–81090 (Orthodontie)",
  "physiotherapie": "Codes RAMQ E120, E121 (si applicable) + codes CSST/SAAQ",
  "massage": "Massothérapie (code selon assureur — ex: 19.04 Sun Life)",
  "psychologie": "Psychothérapie (code 87.1 selon assureur)",
  "consultation generale": "01202 (Examen complet) ou 01201 (Examen limité)",
}

export async function POST(req: Request) {
  try {
    return await handleParler(req)
  } catch (err) {
    console.error("[voice/agent/parler] unhandled error:", err)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq-beige.vercel.app"
    const conv = encodeURIComponent(btoa("[]"))
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="${appUrl}/api/webhooks/voice/agent/parler?orgId=&amp;caller=&amp;conv=${conv}" method="POST" language="fr-CA" speechTimeout="3" timeout="10"><Say language="fr-CA" voice="${VOICE}">Desole, j ai eu un probleme. Comment puis-je vous aider?</Say></Gather></Response>`
    return new Response(xml, { headers: { "Content-Type": "text/xml" } })
  }
}

async function handleParler(req: Request) {
  const url = new URL(req.url)
  let orgId = url.searchParams.get("orgId") ?? ""
  const caller = url.searchParams.get("caller") ?? ""
  const convRaw = url.searchParams.get("conv") ?? btoa("[]")

  const body = await req.formData()
  const speechResult = (body.get("SpeechResult") as string | null) ?? ""
  const confidence = parseFloat((body.get("Confidence") as string | null) ?? "0")

  if (!orgId) {
    const fallback = await db.organisation.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } })
    if (fallback) orgId = fallback.id
  }

  if (confidence < 0.3 && speechResult.length < 4) {
    return nextGather(orgId, caller, convRaw, "Je n'ai pas bien saisi. Pouvez-vous repeter s'il vous plait?")
  }

  let conv: Msg[] = []
  try { conv = JSON.parse(atob(convRaw)) as Msg[] } catch { conv = [] }
  conv.push({ role: "user", content: speechResult })
  if (conv.length > 20) conv = conv.slice(-20)

  const org = orgId ? await db.organisation.findUnique({
    where: { id: orgId },
    select: { nom: true, telephone: true, adresse: true, ville: true, parametres: { select: { heureDebutEnvoi: true, heureFinEnvoi: true, fuseauHoraire: true } } },
  }) : null

  const patient = caller ? await db.patient.findFirst({
    where: { orgId, telephone: caller },
    select: { id: true, prenom: true, nom: true, telephone: true, assuranceStatut: true },
  }) : null

  const praticiens = orgId ? await db.praticien.findMany({
    where: { orgId, actif: true },
    select: { id: true, prenom: true, nom: true, specialite: true },
  }) : []

  const tz = org?.parametres?.fuseauHoraire ?? "America/Toronto"
  const heureDebut = parseInt((org?.parametres?.heureDebutEnvoi ?? "08:00").split(":")[0])
  const heureFin = parseInt((org?.parametres?.heureFinEnvoi ?? "18:00").split(":")[0])
  const listePraticiens = praticiens.map((p) => `${p.prenom} ${p.nom}${p.specialite ? ` (${p.specialite})` : ""} [ID:${p.id}]`).join(", ") || "nos praticiens"

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_creneaux_disponibles",
        description: "Retourne les creneaux libres groupes par praticien qualifie. Appeler des que le patient veut un RDV.",
        parameters: {
          type: "object",
          properties: {
            typeConsultation: { type: "string", description: "Type de consultation (ex: Invisalign, Nettoyage, Physiotherapie, Massage)" },
            praticienNom: { type: "string", description: "Nom du praticien prefere (optionnel)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reserver_rdv",
        description: "Cree le RDV dans le calendrier ET envoie confirmation SMS + formulaire anamnese. Appeler seulement quand on a: prenom, nom, creneau, type consultation. Utiliser le localIso EXACT de get_creneaux_disponibles.",
        parameters: {
          type: "object",
          required: ["prenomPatient", "nomPatient", "creneauIso", "typeConsultation"],
          properties: {
            prenomPatient: { type: "string" },
            nomPatient: { type: "string" },
            creneauIso: { type: "string", description: "Copier EXACTEMENT le localIso de get_creneaux_disponibles. Format: 2026-05-12T10:00:00" },
            typeConsultation: { type: "string" },
            praticienId: { type: "string", description: "ID exact du praticien depuis get_creneaux_disponibles" },
            dureeMinutes: { type: "number", description: "Duree en minutes, defaut 60" },
            notesRaison: { type: "string", description: "Raison ou symptomes mentionnes" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "enregistrer_assurance",
        description: "Enregistre les informations d'assurance du patient apres qu'il a confirme en avoir une. Appeler quand le patient dit avoir une assurance privee.",
        parameters: {
          type: "object",
          required: ["statut"],
          properties: {
            statut: { type: "string", enum: ["OUI", "NON", "INCONNU"], description: "OUI si assure, NON si non assure, INCONNU si ne sait pas" },
            assureurNom: { type: "string", description: "Nom de l'assureur (Sun Life, Croix Bleue, Manulife, etc.)" },
            numPolice: { type: "string", description: "Numero de police ou contrat" },
            numMembre: { type: "string", description: "Numero de membre" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ajouter_liste_attente",
        description: "Ajoute le patient en liste d'attente quand aucun creneau n'est disponible. Le patient sera contacte automatiquement si une place se libere.",
        parameters: {
          type: "object",
          required: ["prenomPatient", "nomPatient", "typeConsultation"],
          properties: {
            prenomPatient: { type: "string" },
            nomPatient: { type: "string" },
            typeConsultation: { type: "string" },
            praticienId: { type: "string", description: "ID praticien prefere (optionnel)" },
            dureeMinutes: { type: "number", description: "Duree estimee en minutes" },
            notes: { type: "string", description: "Disponibilites ou preferences du patient" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "analyser_besoin",
        description: "Analyse les symptomes ou la situation du patient et recommande le type de specialiste approprie. Utiliser quand le patient ne sait pas quel type de soin il lui faut.",
        parameters: {
          type: "object",
          required: ["description"],
          properties: {
            description: { type: "string", description: "Description des symptomes ou du probleme du patient" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_rdv_patient",
        description: "Retourne le prochain RDV du patient.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "confirmer_rdv_patient",
        description: "Confirme le prochain RDV du patient dans le systeme.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "annuler_rdv_patient",
        description: "Annule le prochain RDV du patient. Verifier automatiquement la liste d'attente apres.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "laisser_message",
        description: "Enregistre un message pour l'equipe clinique.",
        parameters: {
          type: "object",
          required: ["message", "nomAppelant"],
          properties: {
            nomAppelant: { type: "string" },
            message: { type: "string" },
            urgence: { type: "boolean" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "transferer_humain",
        description: "Transfere l'appel. Pour: urgence medicale, resultats analyses, ordonnances, plaintes, demande explicite.",
        parameters: { type: "object", properties: {} },
      },
    },
  ]

  const { day: todayDay, month: todayMonth, year: todayYear, hour: todayHour } = nowInTz(tz)

  const systemPrompt = `Tu es Sophie, l'assistante vocale de ${org?.nom ?? "la clinique"} — professionnelle, chaleureuse, efficace.

INFOS CLINIQUE:
- Nom: ${org?.nom ?? "notre clinique"}
- Adresse: ${org?.adresse ? `${org.adresse}, ${org.ville}` : "nous contacter pour l'adresse"}
- Tel: ${org?.telephone ?? "nous contacter"}
- Horaires: lundi-vendredi ${org?.parametres?.heureDebutEnvoi ?? "8h00"}-${org?.parametres?.heureFinEnvoi ?? "18h00"}
- Praticiens: ${listePraticiens}
- Aujourd'hui: ${format(new Date(todayYear, todayMonth - 1, todayDay, todayHour), "EEEE d MMMM yyyy à HH'h'mm", { locale: fr })}

PATIENT: ${patient ? `${patient.prenom} ${patient.nom} — identifie par son numero. Assurance: ${patient.assuranceStatut ?? "non renseignee"}` : "non identifie"}

REGLES VOCALES:
- Max 2 phrases par reponse — sera lue a voix haute
- Jamais de listes, tirets, asterisques ou symboles dans ta reponse parlée
- Parle naturellement en quebecois
- Si STT transcrit mal un nom: repete-le et demande confirmation

FLUX PRISE DE RDV (dans l'ordre):
1. Demander type de consultation si pas mentionne (ou appeler analyser_besoin si symptomes vagues)
2. Appeler get_creneaux_disponibles avec le typeConsultation
3. Proposer 2-3 options oralement par praticien
4. Creneau confirme → si patient inconnu, demander prenom et nom
5. Confirmer a voix haute: "Je reserve pour [Prenom Nom] le [date] a [heure] pour [type] avec [praticien]. C'est bien ca?"
6. Si confirmation → demander ASSURANCE: "Avez-vous une assurance privee pour ce service?"
   - OUI → demander: nom assureur, numero police, numero membre → appeler enregistrer_assurance
   - NON → appeler enregistrer_assurance avec statut NON
   - Je ne sais pas → appeler enregistrer_assurance avec statut INCONNU
7. Appeler reserver_rdv
8. Dire: "Parfait! Votre RDV est confirme. Vous recevrez un SMS de confirmation et un formulaire de sante a remplir avant votre visite."

INSTRUCTION CRITIQUE pour reserver_rdv:
- Utiliser le localIso EXACTEMENT tel que fourni par get_creneaux_disponibles
- Utiliser le praticienId exact (entre crochets dans la liste)

QUAND AUCUN CRENEAU DISPONIBLE:
- Proposer la liste d'attente: "Je n'ai pas de disponibilite dans les prochaines semaines. Voulez-vous etre sur notre liste d'attente? Des qu'une place se libere, on vous texte immediatement."
- Si oui → appeler ajouter_liste_attente

ANALYSE DES BESOINS (si symptomes vagues):
- Appeler analyser_besoin → proposer le specialiste correspondant
- Ex: "J'ai mal au genou depuis 2 semaines" → analyser → suggerer physiotherapeute

TOUS LES CAS D'APPEL:
- URGENCE MEDICALE → transferer_humain immediatement
- RDV/CONSULTATION → flux ci-dessus
- CONFIRMER RDV existant → get_rdv_patient puis confirmer_rdv_patient
- ANNULER RDV → annuler_rdv_patient, proposer nouveau creneau ou liste attente
- REPORTER RDV → annuler + nouveau creneau
- INFOS (horaires/adresse) → repondre directement
- RESULTATS/ORDONNANCES → transferer_humain
- PARLER A QUELQU'UN → transferer_humain
- TARIFS/ASSURANCES → donner numero: ${org?.telephone ?? "appelez-nous"}, preciser que les codes de facturation seront sur la facture
- PLAINTE → transferer_humain
- MESSAGE EQUIPE → laisser_message`

  const messages: OAIMsg[] = [
    { role: "system", content: systemPrompt },
    ...conv.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ]

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools,
    tool_choice: "auto",
    max_tokens: 300,
    temperature: 0.4,
  })

  const msg = response.choices[0].message
  let reponseTexte = msg.content ?? ""
  let shouldTransfer = false

  if (msg.tool_calls?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = msg.tool_calls[0] as any
    const toolName = call.function?.name ?? ""
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let args: Record<string, any> = {}
    try { args = JSON.parse(call.function?.arguments ?? "{}") } catch { /* */ }

    let toolResult = ""

    // ── get_creneaux_disponibles ─────────────────────────────────────────────
    if (toolName === "get_creneaux_disponibles") {
      const typeConsultation = (args.typeConsultation as string | undefined) ?? ""
      const praticienNomArg = (args.praticienNom as string | undefined) ?? ""

      function matcherPraticiens(type: string, nomPref: string) {
        if (!nomPref && !type) return praticiens
        if (nomPref) {
          const n = nomPref.toLowerCase()
          const byName = praticiens.filter((p) => `${p.prenom} ${p.nom}`.toLowerCase().includes(n) || p.nom.toLowerCase().includes(n))
          if (byName.length > 0) return byName
        }
        const keywords: Record<string, string[]> = {
          dentaire: ["dent", "ortho", "invisalign", "nettoyage", "detartrage", "couronne", "carie", "extraction", "blanchiment", "hygieniste"],
          physio: ["physio", "dos", "epaule", "genou", "sport", "rehab", "musculaire", "osteo"],
          massage: ["massage", "massotherap", "relaxation"],
          psycho: ["psych", "anxiete", "depression", "therapie", "mental"],
          optometrie: ["optometr", "vision", "lunette"],
        }
        const typeNorm = type.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        for (const [, kws] of Object.entries(keywords)) {
          if (kws.some((kw) => typeNorm.includes(kw) || kw.includes(typeNorm.split(" ")[0]))) {
            const matched = praticiens.filter((p) => {
              const spec = (p.specialite ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
              return kws.some((kw) => spec.includes(kw) || kw.includes(spec.split(" ")[0]))
            })
            if (matched.length > 0) return matched
          }
        }
        return praticiens
      }

      const praticiensCandidats = matcherPraticiens(typeConsultation, praticienNomArg)

      const rdvsExistants = await db.rendezVous.findMany({
        where: { orgId, dateHeure: { gte: new Date(), lte: addDays(new Date(), 28) }, statut: { notIn: ["ANNULE", "NO_SHOW"] } },
        select: { dateHeure: true, dureeMinutes: true, praticienId: true },
      })

      const lines: string[] = []
      for (const prat of praticiensCandidats) {
        const rdvsPrat = rdvsExistants.filter((r) => r.praticienId === prat.id)
        const slots = getAvailableSlots(
          rdvsPrat.map((r) => ({ dateHeure: new Date(r.dateHeure), dureeMinutes: r.dureeMinutes })),
          heureDebut, heureFin, tz
        )
        if (slots.length > 0) {
          lines.push(`\n${prat.prenom} ${prat.nom}${prat.specialite ? ` (${prat.specialite})` : ""} [praticienId: ${prat.id}]`)
          slots.forEach((s, i) => lines.push(`  ${i + 1}. ${s.display} [localIso: ${s.localIso}]`))
        }
      }

      if (lines.length === 0) {
        toolResult = `Aucun creneau libre dans les 28 prochains jours. Proposer la liste d'attente.`
      } else {
        toolResult = `Creneaux disponibles (${tz}):` + lines.join("\n")
      }

    // ── reserver_rdv ─────────────────────────────────────────────────────────
    } else if (toolName === "reserver_rdv") {
      const { prenomPatient, nomPatient, creneauIso, typeConsultation, praticienId, dureeMinutes, notesRaison } = args as {
        prenomPatient: string; nomPatient: string; creneauIso: string; typeConsultation: string
        praticienId?: string; dureeMinutes?: number; notesRaison?: string
      }

      if (!prenomPatient || !nomPatient || !creneauIso) {
        toolResult = "Informations manquantes. Il faut prenom, nom et creneau."
      } else if (!orgId) {
        toolResult = "Erreur: clinique non identifiee. Transferer a l'equipe."
      } else {
        try {
          const dateHeure = parseLocalIso(creneauIso, tz)
          if (isNaN(dateHeure.getTime())) throw new Error("Date invalide: " + creneauIso)

          console.log(`[reserver_rdv] creneauIso=${creneauIso} → dateHeure UTC=${dateHeure.toISOString()} → Montreal=${dateHeure.toLocaleString("fr-CA", { timeZone: tz })}`)

          let pat = caller ? await db.patient.findFirst({ where: { orgId, telephone: caller } }) : null
          if (!pat) {
            pat = await db.patient.create({
              data: {
                orgId, prenom: prenomPatient.trim(), nom: nomPatient.trim(),
                telephone: caller || `+1000000000${Date.now().toString().slice(-4)}`,
                consentementSMS: !!caller, nouveauPatient: true,
              },
            })
          } else {
            await db.patient.update({ where: { id: pat.id }, data: { prenom: prenomPatient.trim(), nom: nomPatient.trim() } })
          }

          const praticien = praticienId
            ? (praticiens.find((p) => p.id === praticienId) ?? praticiens[0])
            : praticiens[0]

          if (!praticien) {
            toolResult = "Aucun praticien disponible. Transferer a l'equipe."
          } else {
            const rdv = await db.rendezVous.create({
              data: {
                orgId, patientId: pat.id, praticienId: praticien.id,
                dateHeure, dureeMinutes: dureeMinutes ?? 60,
                typeRdv: typeConsultation, notes: notesRaison ?? null,
                statut: "CONFIRME", confirmeParPatient: true, confirmeLeDate: new Date(),
              },
            })

            await db.communication.create({
              data: {
                orgId, patientId: pat.id, rendezvousId: rdv.id,
                type: "CONFIRMATION_RDV", canal: "VOCAL", statut: "ENVOYE",
                contenu: `RDV pris par telephone (agent IA): ${typeConsultation}`, envoyeLe: new Date(),
              },
            })

            // SMS confirmation
            if (caller) {
              try {
                const { envoyerSMS } = await import("@/lib/twilio")
                const localStr = dateHeure.toLocaleString("fr-CA", {
                  timeZone: tz, weekday: "long", day: "numeric", month: "long",
                  hour: "2-digit", minute: "2-digit", hour12: false,
                })
                await envoyerSMS(caller, `Bonjour ${prenomPatient}! RDV confirme chez ${org?.nom ?? "la clinique"}: ${localStr} avec ${praticien.prenom} ${praticien.nom} (${typeConsultation}). Tel: ${org?.telephone ?? ""}`)
                console.log("[reserver_rdv] SMS confirmation envoye a", caller)
              } catch (smsErr) { console.error("[reserver_rdv] SMS confirmation:", smsErr) }
            }

            // Anamnèse form
            let formulaireEnvoye = false
            try {
              const formulaire = await db.formulaire.findFirst({ where: { orgId, actif: true }, select: { id: true } })
              if (formulaire && caller) {
                const token = crypto.randomUUID().replace(/-/g, "")
                const expireA = new Date(dateHeure.getTime() - 2 * 3600000)
                await db.formulaireReponse.create({
                  data: { formulaireId: formulaire.id, patientId: pat.id, rendezvousId: rdv.id, reponses: {}, lienToken: token, expireA },
                })
                const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq-beige.vercel.app"
                const { envoyerSMS: smsForm } = await import("@/lib/twilio")
                await smsForm(caller, `Avant votre RDV, veuillez remplir votre formulaire: ${appUrl}/f/${token}`)
                await db.rendezVous.update({ where: { id: rdv.id }, data: { formulaireEnvoye: true } })
                formulaireEnvoye = true
              }
            } catch (fErr) { console.error("[reserver_rdv] formulaire:", fErr) }

            const dateDisplay = dateHeure.toLocaleString("fr-CA", {
              timeZone: tz, weekday: "long", day: "numeric", month: "long",
              hour: "2-digit", minute: "2-digit", hour12: false,
            })
            toolResult = `RDV cree! ${prenomPatient} ${nomPatient} — ${dateDisplay} avec ${praticien.prenom} ${praticien.nom} (${typeConsultation}, ${dureeMinutes ?? 60} min). SMS envoye.${formulaireEnvoye ? " Formulaire anamnese envoye." : ""}`
          }
        } catch (e) {
          console.error("[reserver_rdv] erreur:", e)
          toolResult = `Erreur technique: ${String(e)}. Proposer de transferer ou rappeler.`
        }
      }

    // ── enregistrer_assurance ────────────────────────────────────────────────
    } else if (toolName === "enregistrer_assurance") {
      const { statut, assureurNom, numPolice, numMembre } = args as {
        statut: "OUI" | "NON" | "INCONNU"; assureurNom?: string; numPolice?: string; numMembre?: string
      }
      try {
        const patId = patient?.id ?? (caller ? (await db.patient.findFirst({ where: { orgId, telephone: caller } }))?.id : null)
        if (patId) {
          await db.patient.update({
            where: { id: patId },
            data: {
              assuranceStatut: statut as import("@prisma/client").AssuranceStatut,
              assuranceNom: assureurNom ?? null,
              assuranceNumPolice: numPolice ?? null,
              assuranceNumMembre: numMembre ?? null,
              assuranceConsente: statut === "OUI",
            },
          })
        }

        if (statut === "OUI") {
          toolResult = `Assurance enregistree: ${assureurNom ?? "assureur"}, police ${numPolice ?? "N/A"}, membre ${numMembre ?? "N/A"}. La facture sera envoyee avec les codes de facturation apres le RDV.`
        } else if (statut === "NON") {
          toolResult = "Patient note comme non assure. La facture normale lui sera envoyee apres le RDV."
        } else {
          toolResult = "Patient note comme ne sachant pas s'il est assure. On lui enverra la facture avec un guide sur les codes de facturation."
        }
      } catch (e) {
        console.error("[enregistrer_assurance]", e)
        toolResult = "Assurance notee pour l'equipe."
      }

    // ── ajouter_liste_attente ────────────────────────────────────────────────
    } else if (toolName === "ajouter_liste_attente") {
      const { prenomPatient, nomPatient, typeConsultation, praticienId: pratId, dureeMinutes: duree, notes: notesLA } = args as {
        prenomPatient: string; nomPatient: string; typeConsultation: string
        praticienId?: string; dureeMinutes?: number; notes?: string
      }
      try {
        let pat = caller ? await db.patient.findFirst({ where: { orgId, telephone: caller } }) : null
        if (!pat) {
          pat = await db.patient.create({
            data: {
              orgId, prenom: prenomPatient.trim(), nom: nomPatient.trim(),
              telephone: caller || `+1000000000${Date.now().toString().slice(-4)}`,
              consentementSMS: !!caller, nouveauPatient: true,
            },
          })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).listeAttente.create({
          data: {
            orgId, patientId: pat.id,
            praticienId: pratId ?? null,
            typeRdv: typeConsultation,
            dureeMinutes: duree ?? 60,
            notes: notesLA ?? null,
            statut: "EN_ATTENTE",
          },
        })
        toolResult = `${prenomPatient} ${nomPatient} ajoute a la liste d'attente pour ${typeConsultation}. Sera contacte automatiquement des qu'une place se libere.`
      } catch (e) {
        console.error("[ajouter_liste_attente]", e)
        toolResult = "Ajoute a la liste d'attente. L'equipe sera notifiee."
      }

    // ── analyser_besoin ──────────────────────────────────────────────────────
    } else if (toolName === "analyser_besoin") {
      const { description } = args as { description: string }
      const praticiensList = praticiens.map((p) => `${p.prenom} ${p.nom}${p.specialite ? ` (${p.specialite})` : ""}`).join(", ")

      const analysisResp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant medical pour une clinique au Quebec. Praticiens disponibles: ${praticiensList || "generalistes"}.
Analyse les symptomes et recommande le specialiste le plus adapte parmi ceux disponibles.
Reponds en JSON: { "specialiste": "type recommande", "praticienNom": "nom du praticien de la liste", "praticienId": "id si disponible", "urgence": false, "explication": "courte raison (1 phrase)", "alternativesSiRefus": ["autre option 1", "autre option 2"] }`,
          },
          { role: "user", content: description },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3,
      })
      try {
        const analysis = JSON.parse(analysisResp.choices[0].message.content ?? "{}")
        if (analysis.urgence) {
          toolResult = `URGENCE detectee. Transferer immediatement.`
        } else {
          toolResult = `Recommandation: ${analysis.specialiste}. ${analysis.praticienNom ? `Praticien suggere: ${analysis.praticienNom}.` : ""} ${analysis.explication}. Alternatives: ${(analysis.alternativesSiRefus ?? []).join(", ")}.`
        }
      } catch {
        toolResult = `Besoin analyse: ${description}. Recommander selon les praticiens disponibles.`
      }

    // ── get_rdv_patient ──────────────────────────────────────────────────────
    } else if (toolName === "get_rdv_patient") {
      if (!patient) {
        toolResult = "Patient non identifie. Demander le nom complet."
      } else {
        const rdv = await db.rendezVous.findFirst({
          where: { orgId, patientId: patient.id, dateHeure: { gte: new Date() }, statut: { notIn: ["ANNULE"] } },
          orderBy: { dateHeure: "asc" },
          include: { praticien: { select: { prenom: true, nom: true } } },
        })
        if (rdv) {
          const dateDisplay = new Date(rdv.dateHeure).toLocaleString("fr-CA", {
            timeZone: tz, weekday: "long", day: "numeric", month: "long",
            hour: "2-digit", minute: "2-digit", hour12: false,
          })
          toolResult = `RDV: ${dateDisplay} avec ${rdv.praticien.prenom} ${rdv.praticien.nom}. Statut: ${rdv.confirmeParPatient ? "confirme" : "non confirme"}. ID: ${rdv.id}`
        } else {
          toolResult = `Aucun RDV a venir pour ${patient.prenom} ${patient.nom}.`
        }
      }

    // ── confirmer_rdv_patient ────────────────────────────────────────────────
    } else if (toolName === "confirmer_rdv_patient") {
      if (!patient) {
        toolResult = "Patient non identifie."
      } else {
        const rdv = await db.rendezVous.findFirst({
          where: { orgId, patientId: patient.id, dateHeure: { gte: new Date() }, statut: { notIn: ["ANNULE"] } },
          orderBy: { dateHeure: "asc" },
        })
        if (rdv) {
          await db.rendezVous.update({ where: { id: rdv.id }, data: { confirmeParPatient: true, confirmeLeDate: new Date() } })
          toolResult = "RDV confirme!"
        } else {
          toolResult = "Aucun RDV a confirmer."
        }
      }

    // ── annuler_rdv_patient ──────────────────────────────────────────────────
    } else if (toolName === "annuler_rdv_patient") {
      if (!patient) {
        toolResult = "Patient non identifie."
      } else {
        const rdv = await db.rendezVous.findFirst({
          where: { orgId, patientId: patient.id, dateHeure: { gte: new Date() }, statut: { notIn: ["ANNULE"] } },
          orderBy: { dateHeure: "asc" },
          include: { praticien: { select: { prenom: true, nom: true } } },
        })
        if (rdv) {
          await db.rendezVous.update({ where: { id: rdv.id }, data: { statut: "ANNULE" } })
          const dateDisplay = new Date(rdv.dateHeure).toLocaleString("fr-CA", {
            timeZone: tz, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false,
          })

          // Notify waiting list
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const candidat = await (db as any).listeAttente.findFirst({
              where: { orgId, statut: "EN_ATTENTE", dureeMinutes: { lte: rdv.dureeMinutes }, OR: [{ praticienId: rdv.praticienId }, { praticienId: null }] },
              include: { patient: { select: { prenom: true, telephone: true, consentementSMS: true, langue: true } }, organisation: { select: { nom: true } } },
              orderBy: { createdAt: "asc" },
            })
            if (candidat?.patient.consentementSMS && candidat.patient.telephone) {
              const { envoyerSMS } = await import("@/lib/twilio")
              const msg = candidat.patient.langue === "EN"
                ? `Hi ${candidat.patient.prenom}! A slot just opened at ${candidat.organisation.nom}: ${dateDisplay}. Reply YES to book it now (valid 30 min).`
                : `Bonjour ${candidat.patient.prenom}! Une place vient de se liberer chez ${candidat.organisation.nom}: le ${dateDisplay}. Repondez OUI pour la reserver (valable 30 min).`
              await envoyerSMS(candidat.patient.telephone, msg)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (db as any).listeAttente.update({ where: { id: candidat.id }, data: { statut: "NOTIFIE", notifieLe: new Date(), creneauPropose: rdv.dateHeure } })
            }
          } catch { /* non-blocking */ }

          toolResult = `RDV du ${dateDisplay} annule. Liste d'attente verifiee.`
        } else {
          toolResult = "Aucun RDV a annuler."
        }
      }

    // ── laisser_message ──────────────────────────────────────────────────────
    } else if (toolName === "laisser_message") {
      const { nomAppelant, message, urgence } = args as { nomAppelant: string; message: string; urgence?: boolean }
      const patId = patient?.id ?? (caller ? (await db.patient.findFirst({ where: { orgId, telephone: caller }, select: { id: true } }))?.id : null) ?? null
      if (patId) {
        await db.communication.create({
          data: {
            orgId, patientId: patId,
            type: "REPONSE_ENTRANTE", canal: "VOCAL", statut: "REPONDU",
            contenu: `[MESSAGE VOCAL${urgence ? " - URGENT" : ""}] De: ${nomAppelant ?? (patient ? `${patient.prenom} ${patient.nom}` : "inconnu")}. Message: ${message}`,
            reponsePatient: message, reponseRecueLe: new Date(), envoyeLe: new Date(),
            urgence: urgence ?? false,
          },
        })
      }
      toolResult = `Message enregistre pour l'equipe.${urgence ? " Marque URGENT." : ""}`

    // ── transferer_humain ────────────────────────────────────────────────────
    } else if (toolName === "transferer_humain") {
      shouldTransfer = true
      toolResult = "Transfert en cours."
      reponseTexte = "Je vous transfere immediatement a un membre de notre equipe. Veuillez rester en ligne."
    }

    if (!shouldTransfer) {
      const finalResp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...messages,
          msg,
          { role: "tool", tool_call_id: call.id, content: toolResult },
        ],
        max_tokens: 250,
        temperature: 0.4,
      })
      reponseTexte = finalResp.choices[0].message.content ?? reponseTexte
    }
  }

  conv.push({ role: "assistant", content: reponseTexte })
  const farewell = /au revoir|bonne journee|a bientot|bonne fin|merci.*bientot|c.est tout|au plaisir|bonne soiree/i.test(reponseTexte)

  if (shouldTransfer || farewell) {
    // Generate AI call summary
    await genererResumeAppel(conv, orgId, patient?.id ?? null, caller)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA" voice="${VOICE}">${escapeXml(reponseTexte)}</Say>
  ${shouldTransfer && org?.telephone ? `<Dial>${escapeXml(org.telephone)}</Dial>` : ""}
</Response>`
    return new Response(xml, { headers: { "Content-Type": "text/xml" } })
  }

  return nextGather(orgId, caller, btoa(JSON.stringify(conv)), reponseTexte)
}

async function genererResumeAppel(conv: Msg[], orgId: string, patientId: string | null, caller: string) {
  try {
    const convTexte = conv
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role === "user" ? "Patient" : "Sophie"}: ${m.content}`)
      .join("\n")

    const summaryResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyse cette conversation telephonique d'une clinique medicale et genere un resume JSON:
{
  "resume": "2-3 phrases max resumant l'appel",
  "actionsRequises": "actions specifiques pour l'equipe (null si aucune)",
  "urgence": false,
  "tags": ["TAG1", "TAG2"]
}
Tags possibles: RESERVATION, ANNULATION, CONFIRMATION, INFORMATION, URGENCE, ASSURANCE, RESULTAT, PLAINTE, LISTE_ATTENTE, TRANSFERT, MESSAGE, ROUTING`,
        },
        { role: "user", content: convTexte },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.2,
    })

    const summary = JSON.parse(summaryResp.choices[0].message.content ?? "{}")
    const patId = patientId ?? (caller ? (await db.patient.findFirst({ where: { orgId, telephone: caller }, select: { id: true } }))?.id : null)

    if (patId && orgId) {
      await db.communication.create({
        data: {
          orgId,
          patientId: patId,
          type: "REPONSE_ENTRANTE",
          canal: "VOCAL",
          statut: "ENVOYE",
          contenu: summary.resume ?? "Appel traite par Sophie (agent IA)",
          resumeIA: summary.resume ?? null,
          actionsRequises: summary.actionsRequises ?? null,
          urgence: summary.urgence ?? false,
          tagsIA: summary.tags ?? [],
          envoyeLe: new Date(),
        },
      })
    }
  } catch (e) {
    console.error("[genererResumeAppel]", e)
  }
}

function nextGather(orgId: string, caller: string, conv: string, message: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq-beige.vercel.app"
  const actionUrl = `${appUrl}/api/webhooks/voice/agent/parler?orgId=${orgId}&amp;caller=${encodeURIComponent(caller)}&amp;conv=${encodeURIComponent(conv)}`
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" language="fr-CA" speechTimeout="3" timeout="12">
    <Say language="fr-CA" voice="${VOICE}">${escapeXml(message)}</Say>
  </Gather>
  <Say language="fr-CA" voice="${VOICE}">Je n'ai pas entendu de reponse. N'hesitez pas a rappeler. Bonne journee!</Say>
</Response>`
  return new Response(xml, { headers: { "Content-Type": "text/xml" } })
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
