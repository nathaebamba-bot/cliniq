import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { TypeAutomatisation } from "@prisma/client"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const automatisationRouter = createTRPCRouter({
  liste: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    return ctx.db.automatisation.findMany({
      where: { orgId },
      orderBy: { type: "asc" },
    })
  }),

  toggleActif: protectedProcedure
    .input(z.object({ id: z.string(), actif: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.automatisation.findFirst({
        where: { id: input.id, orgId },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.automatisation.update({
        where: { id: input.id },
        data: { actif: input.actif },
      })
    }),

  upsertRappelRdv: protectedProcedure
    .input(
      z.object({
        rappelActif: z.boolean(),
        rappelDelai48h: z.boolean(),
        rappelDelai24h: z.boolean(),
        rappelDelai2h: z.boolean(),
        messageSMS48h: z.string().min(1),
        messageSMS24h: z.string().min(1),
        heureDebutEnvoi: z.string(),
        heureFinEnvoi: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)

      // Update ParametresClinique
      await ctx.db.parametresClinique.upsert({
        where: { orgId },
        create: { orgId, ...input },
        update: input,
      })

      // Upsert automatisation record for stats
      const existing = await ctx.db.automatisation.findFirst({
        where: { orgId, type: "RAPPEL_RDV" },
      })

      if (existing) {
        return ctx.db.automatisation.update({
          where: { id: existing.id },
          data: { actif: input.rappelActif },
        })
      }

      return ctx.db.automatisation.create({
        data: {
          orgId,
          nom: "Rappels rendez-vous",
          type: "RAPPEL_RDV",
          actif: input.rappelActif,
          config: input,
        },
      })
    }),

  upsertFormulaireAnamne: protectedProcedure
    .input(
      z.object({
        formulaireActif: z.boolean(),
        formulaireDelai: z.number().int().min(1).max(168),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      await ctx.db.parametresClinique.upsert({
        where: { orgId },
        create: { orgId, ...input },
        update: input,
      })
      const existing = await ctx.db.automatisation.findFirst({ where: { orgId, type: "FORMULAIRE_ANAMNE" } })
      if (existing) return ctx.db.automatisation.update({ where: { id: existing.id }, data: { actif: input.formulaireActif } })
      return ctx.db.automatisation.create({
        data: { orgId, nom: "Formulaires anamnèse", type: "FORMULAIRE_ANAMNE", actif: input.formulaireActif, config: input },
      })
    }),

  upsertCollecteAvis: protectedProcedure
    .input(
      z.object({
        avisActif: z.boolean(),
        avisDelaiApresRdv: z.number().int().min(0).max(72),
        avisMessageSMS: z.string().min(1),
        avisLienGoogle: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      await ctx.db.parametresClinique.upsert({
        where: { orgId },
        create: { orgId, ...input },
        update: input,
      })
      const existing = await ctx.db.automatisation.findFirst({ where: { orgId, type: "COLLECTE_AVIS" } })
      if (existing) return ctx.db.automatisation.update({ where: { id: existing.id }, data: { actif: input.avisActif } })
      return ctx.db.automatisation.create({
        data: { orgId, nom: "Collecte d'avis Google", type: "COLLECTE_AVIS", actif: input.avisActif, config: input },
      })
    }),

  upsertRelanceTraitement: protectedProcedure
    .input(
      z.object({
        relanceActif: z.boolean(),
        relanceDelaiJours: z.number().int().min(1).max(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      await ctx.db.parametresClinique.upsert({
        where: { orgId },
        create: { orgId, ...input },
        update: input,
      })
      const existing = await ctx.db.automatisation.findFirst({ where: { orgId, type: "RELANCE_TRAITEMENT" } })
      if (existing) return ctx.db.automatisation.update({ where: { id: existing.id }, data: { actif: input.relanceActif } })
      return ctx.db.automatisation.create({
        data: { orgId, nom: "Relances traitements", type: "RELANCE_TRAITEMENT", actif: input.relanceActif, config: input },
      })
    }),

  getParametres: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    return ctx.db.parametresClinique.findUnique({ where: { orgId } })
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const maintenant = new Date()
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

    const [rappelEnvoyes, avisEnvoyes, relancesEnvoyees, formsSent] = await Promise.all([
      ctx.db.communication.count({
        where: { orgId, type: "RAPPEL_RDV", createdAt: { gte: debutMois } },
      }),
      ctx.db.communication.count({
        where: { orgId, type: "COLLECTE_AVIS", createdAt: { gte: debutMois } },
      }),
      ctx.db.communication.count({
        where: { orgId, type: "RELANCE_TRAITEMENT", createdAt: { gte: debutMois } },
      }),
      ctx.db.communication.count({
        where: { orgId, type: "FORMULAIRE_ANAMNE", createdAt: { gte: debutMois } },
      }),
    ])

    return { rappelEnvoyes, avisEnvoyes, relancesEnvoyees, formsSent }
  }),
})
