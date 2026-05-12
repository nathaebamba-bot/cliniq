import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"
import { StatutRdv } from "@prisma/client"
import { addDays, startOfDay, endOfDay, format } from "date-fns"
import { fr } from "date-fns/locale"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation introuvable" })
  return org.id
}

export const rendezVousRouter = createTRPCRouter({
  liste: protectedProcedure
    .input(
      z.object({
        dateDebut: z.date(),
        dateFin: z.date(),
        praticienId: z.string().optional(),
        statut: z.nativeEnum(StatutRdv).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.rendezVous.findMany({
        where: {
          orgId,
          dateHeure: { gte: input.dateDebut, lte: input.dateFin },
          ...(input.praticienId ? { praticienId: input.praticienId } : {}),
          ...(input.statut ? { statut: input.statut } : {}),
        },
        include: {
          patient: { select: { id: true, prenom: true, nom: true, telephone: true } },
          praticien: { select: { id: true, prenom: true, nom: true, couleur: true } },
        },
        orderBy: { dateHeure: "asc" },
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
        praticienId: z.string(),
        dateHeure: z.date(),
        dureeMinutes: z.number().int().min(15).max(480).default(60),
        typeRdv: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.rendezVous.create({
        data: { ...input, orgId },
        include: {
          patient: { select: { id: true, prenom: true, nom: true } },
          praticien: { select: { id: true, prenom: true, nom: true, couleur: true } },
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        patientId: z.string().optional(),
        praticienId: z.string().optional(),
        dateHeure: z.date().optional(),
        dureeMinutes: z.number().int().min(15).max(480).optional(),
        typeRdv: z.string().optional(),
        notes: z.string().optional(),
        statut: z.nativeEnum(StatutRdv).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.rendezVous.findFirst({ where: { id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.rendezVous.update({ where: { id }, data })
    }),

  updateStatut: protectedProcedure
    .input(z.object({ id: z.string(), statut: z.nativeEnum(StatutRdv) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.rendezVous.findFirst({
        where: { id: input.id, orgId },
        include: {
          patient: { select: { prenom: true, nom: true, courriel: true, langue: true, telephone: true } },
          praticien: { select: { prenom: true, nom: true } },
          organisation: { select: { nom: true, courriel: true, couleurPrimaire: true, telephone: true } },
        },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })

      const rdv = await ctx.db.rendezVous.update({
        where: { id: input.id },
        data: { statut: input.statut },
      })

      // Waiting list: notify first matching patient when a slot is freed
      if (input.statut === "ANNULE") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const listeAttente = (ctx.db as any).listeAttente
          const candidats = await listeAttente.findMany({
            where: {
              orgId,
              statut: "EN_ATTENTE",
              dureeMinutes: { lte: existing.dureeMinutes },
              OR: [
                { praticienId: existing.praticienId },
                { praticienId: null },
              ],
            },
            include: {
              patient: { select: { prenom: true, telephone: true, consentementSMS: true, langue: true } },
              organisation: { select: { nom: true, telephone: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 1,
          })
          if (candidats.length > 0) {
            const candidat = candidats[0]
            const dateStr = format(new Date(existing.dateHeure), "d MMMM 'à' HH:mm", { locale: fr })
            if (candidat.patient.consentementSMS && candidat.patient.telephone) {
              const { envoyerSMS } = await import("@/lib/twilio")
              const msg = candidat.patient.langue === "EN"
                ? `Hi ${candidat.patient.prenom}! A slot opened at ${candidat.organisation.nom}: ${dateStr}. Reply YES to book it now (offer valid 30 min).`
                : `Bonjour ${candidat.patient.prenom}! Un créneau s'est libéré à ${candidat.organisation.nom}: le ${dateStr}. Répondez OUI pour le réserver maintenant (offre valable 30 min).`
              await envoyerSMS(candidat.patient.telephone, msg)
            }
            await listeAttente.update({
              where: { id: candidat.id },
              data: { statut: "NOTIFIE", notifieLe: new Date(), creneauPropose: existing.dateHeure },
            })
          }
        } catch {
          // Non-blocking
        }
      }

      // Auto-create draft invoice when RDV is marked COMPLETE
      if (input.statut === "COMPLETE") {
        try {
          const alreadyHasFacture = await ctx.db.facture.findUnique({ where: { rendezvousId: input.id } })
          if (!alreadyHasFacture) {
            const count = await ctx.db.facture.count({ where: { orgId } })
            const year = new Date().getFullYear()
            const numero = `FAC-${year}-${String(count + 1).padStart(4, "0")}`
            const typeService = existing.typeRdv ?? "Consultation"

            // Pre-fill lines from service catalogue if matching type exists
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const servicesCatalogue: any[] = existing.typeRdv
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? await (ctx.db as any).catalogueService.findMany({
                  where: { orgId, typeRdv: existing.typeRdv, actif: true },
                  orderBy: { nom: "asc" },
                })
              : []

            const lignes: { description: string; montant: number }[] = servicesCatalogue.length > 0
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? servicesCatalogue.map((s: any) => ({ description: s.nom as string, montant: Number(s.prix) }))
              : [{ description: typeService, montant: 0 }]

            const sousTotal = lignes.reduce((acc, l) => acc + l.montant, 0)

            await ctx.db.facture.create({
              data: {
                orgId,
                patientId: existing.patientId,
                rendezvousId: input.id,
                numero,
                lignes,
                sousTotal,
                taxes: 0,
                total: sousTotal,
                statut: "BROUILLON",
                destCourriel: existing.patient.courriel,
                destNom: `${existing.patient.prenom} ${existing.patient.nom}`,
              },
            })
          }
        } catch {
          // Non-blocking — don't fail the status update if invoice creation fails
        }
      }

      // Email notification to clinic admin on no-show
      if (input.statut === "NO_SHOW" && existing.organisation.courriel) {
        try {
          const { resend, FROM } = await import("@/lib/resend")
          const { createElement } = await import("react")
          const { NoShowEmail } = await import("@/emails/no-show")
          const dateStr = format(new Date(existing.dateHeure), "d MMMM yyyy", { locale: fr })
          const heureStr = format(new Date(existing.dateHeure), "HH:mm", { locale: fr })
          await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: existing.organisation.courriel,
            subject: `No-show : ${existing.patient.prenom} ${existing.patient.nom} — ${dateStr} à ${heureStr}`,
            react: createElement(NoShowEmail, {
              nomPatient: `${existing.patient.prenom} ${existing.patient.nom}`,
              date: dateStr,
              heure: heureStr,
              praticien: `${existing.praticien.prenom} ${existing.praticien.nom}`,
              clinique: existing.organisation.nom,
              telephone: existing.organisation.telephone,
              couleur: existing.organisation.couleurPrimaire,
            }),
          })
        } catch {
          // Non-blocking — don't fail the status update if email fails
        }
      }

      return rdv
    }),

  bulkUpdateStatut: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100), statut: z.nativeEnum(StatutRdv) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const result = await ctx.db.rendezVous.updateMany({
        where: { id: { in: input.ids }, orgId },
        data: { statut: input.statut },
      })
      return { updated: result.count }
    }),

  supprimer: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.rendezVous.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.rendezVous.delete({ where: { id: input.id } })
    }),

  suggestionsIA: protectedProcedure
    .input(z.object({
      demande: z.string().min(1).max(500),
      praticienId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)

      const [praticiens, rdvsExistants] = await Promise.all([
        ctx.db.praticien.findMany({
          where: { orgId, actif: true },
          select: { id: true, prenom: true, nom: true, specialite: true },
        }),
        ctx.db.rendezVous.findMany({
          where: {
            orgId,
            dateHeure: { gte: startOfDay(new Date()), lte: endOfDay(addDays(new Date(), 14)) },
            statut: { notIn: ["ANNULE", "NO_SHOW"] },
            ...(input.praticienId ? { praticienId: input.praticienId } : {}),
          },
          select: { dateHeure: true, dureeMinutes: true, praticienId: true },
        }),
      ])

      if (!praticiens.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucun praticien actif." })

      const maintenant = new Date()
      const contexteAgenda = rdvsExistants.map((r) =>
        `- ${format(new Date(r.dateHeure), "EEEE d MMM à HH:mm", { locale: fr })} (${r.dureeMinutes} min) — praticien: ${r.praticienId}`
      ).join("\n")

      const listePraticiens = praticiens.map((p) =>
        `${p.id} → ${p.prenom} ${p.nom}${p.specialite ? ` (${p.specialite})` : ""}`
      ).join("\n")

      const prompt = `Tu es un assistant de planification pour une clinique de santé privée québécoise.
Aujourd'hui : ${format(maintenant, "EEEE d MMMM yyyy à HH:mm", { locale: fr })}
Heures d'ouverture : lundi–vendredi 8h00–18h00 (aucun RDV le week-end).

Praticiens disponibles :
${listePraticiens}

RDVs déjà planifiés (14 prochains jours) :
${contexteAgenda || "Aucun"}

Demande du personnel : "${input.demande}"

Propose 3 créneaux optimaux qui ne chevauchent pas les RDV existants.
Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "suggestions": [
    {
      "praticienId": "id exact du praticien",
      "praticienNom": "Prénom Nom",
      "dateHeure": "2026-05-12T09:00:00",
      "dureeMinutes": 60,
      "typeRdv": "type de consultation",
      "explication": "courte raison du choix (1 phrase)"
    }
  ]
}`

      const { default: OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      })

      const raw = completion.choices[0]?.message?.content ?? "{}"
      const parsed = JSON.parse(raw) as {
        suggestions: {
          praticienId: string
          praticienNom: string
          dateHeure: string
          dureeMinutes: number
          typeRdv: string
          explication: string
        }[]
      }

      return parsed.suggestions.map((s) => ({
        ...s,
        dateHeure: new Date(s.dateHeure),
      }))
    }),
})
