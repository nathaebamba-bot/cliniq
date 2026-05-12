import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { subDays, startOfMonth, endOfMonth } from "date-fns"
import { randomUUID } from "crypto"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const avisRouter = createTRPCRouter({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const debutMois = startOfMonth(new Date())
    const finMois = endOfMonth(new Date())

    const [totalMois, cliqueMois, totalAll] = await Promise.all([
      ctx.db.avisGoogle.count({ where: { orgId, dateEnvoi: { gte: debutMois, lte: finMois } } }),
      ctx.db.avisGoogle.count({ where: { orgId, aClique: true, dateEnvoi: { gte: debutMois, lte: finMois } } }),
      ctx.db.avisGoogle.count({ where: { orgId } }),
    ])

    return {
      totalMois,
      cliqueMois,
      tauxClic: totalMois > 0 ? Math.round((cliqueMois / totalMois) * 100) : 0,
      totalAll,
    }
  }),

  liste: protectedProcedure
    .input(z.object({
      limit: z.number().int().max(100).default(50),
      offset: z.number().int().default(0),
      depuis: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const where = {
        orgId,
        ...(input.depuis ? { dateEnvoi: { gte: new Date(input.depuis) } } : {}),
      }

      const [items, total] = await Promise.all([
        ctx.db.avisGoogle.findMany({
          where,
          orderBy: { dateEnvoi: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            patient: { select: { prenom: true, nom: true, telephone: true } },
          },
        }),
        ctx.db.avisGoogle.count({ where }),
      ])

      return { items, total }
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const params = await ctx.db.parametresClinique.findUnique({ where: { orgId } })
    return {
      actif: params?.avisActif ?? true,
      delaiApresRdv: params?.avisDelaiApresRdv ?? 2,
      lienGoogle: params?.avisLienGoogle ?? "",
      messageSMS: params?.avisMessageSMS ?? "Bonjour {{prenom}}, merci pour votre visite! Votre avis nous aide beaucoup: {{lien}}",
    }
  }),

  updateConfig: protectedProcedure
    .input(z.object({
      actif: z.boolean(),
      delaiApresRdv: z.number().int().min(0).max(72),
      lienGoogle: z.string(),
      messageSMS: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.parametresClinique.upsert({
        where: { orgId },
        update: {
          avisActif: input.actif,
          avisDelaiApresRdv: input.delaiApresRdv,
          avisLienGoogle: input.lienGoogle,
          avisMessageSMS: input.messageSMS,
        },
        create: {
          orgId,
          avisActif: input.actif,
          avisDelaiApresRdv: input.delaiApresRdv,
          avisLienGoogle: input.lienGoogle,
          avisMessageSMS: input.messageSMS,
        },
      })
    }),

  envoyerAvisManuel: protectedProcedure
    .input(z.object({
      patientId: z.string(),
      rendezvousId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)

      const [patient, params, org] = await Promise.all([
        ctx.db.patient.findFirst({ where: { id: input.patientId, orgId } }),
        ctx.db.parametresClinique.findUnique({ where: { orgId } }),
        ctx.db.organisation.findUnique({ where: { id: orgId }, select: { nom: true } }),
      ])
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" })
      if (!params?.avisLienGoogle) throw new TRPCError({ code: "BAD_REQUEST", message: "Lien Google My Business non configuré dans les paramètres" })
      if (!patient.consentementSMS || !patient.telephone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Le patient n'a pas de consentement SMS ou de numéro de téléphone." })
      }

      // Create tracking record first, roll back on failure
      const avisRecord = await ctx.db.avisGoogle.create({
        data: { orgId, patientId: input.patientId, lienEnvoye: true, dateEnvoi: new Date() },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq.app"
      const lienSuivi = `${appUrl}/api/avis/click/${avisRecord.id}`

      const template = patient.langue === "EN"
        ? `Hello {{prenom}}, thank you for your visit! Your review helps us a lot: {{lien}}`
        : (params.avisMessageSMS ?? "Bonjour {{prenom}}, merci pour votre visite! Votre avis nous aide beaucoup: {{lien}}")

      const { interpolerMessage } = await import("@/lib/utils")
      const msg = interpolerMessage(template, {
        prenom: patient.prenom,
        nom: patient.nom,
        clinique: org?.nom ?? "",
        lien: lienSuivi,
      })

      try {
        const { envoyerSMS } = await import("@/lib/twilio")
        const sid = await envoyerSMS(patient.telephone, msg)
        await ctx.db.communication.create({
          data: {
            orgId,
            patientId: input.patientId,
            rendezvousId: input.rendezvousId ?? null,
            type: "COLLECTE_AVIS",
            canal: "SMS",
            statut: "ENVOYE",
            contenu: msg,
            twilioSid: sid,
            envoyeLe: new Date(),
          },
        })
        if (input.rendezvousId) {
          await ctx.db.rendezVous.update({
            where: { id: input.rendezvousId },
            data: { avisEnvoye: true },
          }).catch(() => null)
        }
        return { smsSent: true, lienSuivi }
      } catch (err) {
        // Roll back the AvisGoogle record so we don't skew click stats
        await ctx.db.avisGoogle.delete({ where: { id: avisRecord.id } }).catch(() => null)
        const message = err instanceof Error ? err.message : "Erreur Twilio inconnue"
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Échec Twilio: ${message}` })
      }
    }),

  parJour: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const debut = subDays(new Date(), 30)

    const avis = await ctx.db.avisGoogle.findMany({
      where: { orgId, dateEnvoi: { gte: debut } },
      select: { dateEnvoi: true, aClique: true },
    })

    const byDay = new Map<string, { date: string; envoyes: number; cliques: number }>()
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const key = d.toISOString().split("T")[0]
      byDay.set(key, { date: key, envoyes: 0, cliques: 0 })
    }

    for (const a of avis) {
      const key = new Date(a.dateEnvoi).toISOString().split("T")[0]
      const entry = byDay.get(key)
      if (!entry) continue
      entry.envoyes++
      if (a.aClique) entry.cliques++
    }

    return Array.from(byDay.values())
  }),
})
