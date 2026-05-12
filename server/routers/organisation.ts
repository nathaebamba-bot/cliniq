import { z } from "zod/v3"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"
import { TypeClinique } from "@prisma/client"

export const organisationRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.organisation.findUnique({
      where: { clerkOrgId: ctx.orgId },
      include: { parametres: true, praticiens: { where: { actif: true } } },
    })
  }),

  upsert: adminProcedure
    .input(
      z.object({
        nom: z.string().min(1).max(100),
        type: z.nativeEnum(TypeClinique),
        adresse: z.string().optional(),
        ville: z.string().optional(),
        codePostal: z.string().optional(),
        telephone: z.string().optional(),
        courriel: z.string().email().optional().or(z.literal("")),
        siteWeb: z.string().url().optional().or(z.literal("")),
        couleurPrimaire: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.organisation.upsert({
        where: { clerkOrgId: ctx.orgId },
        create: { clerkOrgId: ctx.orgId, ...input },
        update: input,
      })
    }),

  updateParametres: adminProcedure
    .input(
      z.object({
        rappelActif: z.boolean().optional(),
        rappelDelai48h: z.boolean().optional(),
        rappelDelai24h: z.boolean().optional(),
        rappelDelai2h: z.boolean().optional(),
        messageSMS48h: z.string().optional(),
        messageSMS24h: z.string().optional(),
        avisActif: z.boolean().optional(),
        avisDelaiApresRdv: z.number().int().min(0).optional(),
        avisLienGoogle: z.string().url().optional().or(z.literal("")),
        avisMessageSMS: z.string().optional(),
        relanceActif: z.boolean().optional(),
        relanceDelaiJours: z.number().int().min(1).optional(),
        heureDebutEnvoi: z.string().optional(),
        heureFinEnvoi: z.string().optional(),
        fuseauHoraire: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organisation.findUnique({
        where: { clerkOrgId: ctx.orgId },
        select: { id: true },
      })
      if (!org) throw new Error("Organisation introuvable")

      return ctx.db.parametresClinique.upsert({
        where: { orgId: org.id },
        create: { orgId: org.id, ...input },
        update: input,
      })
    }),

  integrationStatus: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organisation.findUnique({
      where: { clerkOrgId: ctx.orgId },
      include: { parametres: { select: { avisLienGoogle: true } } },
    })
    return {
      twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      resend: !!(process.env.RESEND_API_KEY),
      google: !!(org?.parametres?.avisLienGoogle),
    }
  }),
})
