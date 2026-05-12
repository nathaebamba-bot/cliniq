import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const conformiteRouter = createTRPCRouter({
  // Full patient data export (droit d'accès)
  exportPatient: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const patient = await ctx.db.patient.findFirst({
        where: { id: input.patientId, orgId },
        include: {
          rendezvous: { include: { praticien: { select: { prenom: true, nom: true } } } },
          communications: true,
          formulaires: { include: { formulaire: { select: { nom: true } } } },
          avisGoogle: true,
        },
      })
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" })
      return patient
    }),

  // Cascade delete patient (droit à l'effacement)
  supprimerPatient: protectedProcedure
    .input(z.object({
      patientId: z.string(),
      confirmation: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmation !== "SUPPRIMER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation invalide" })
      }
      const orgId = await getOrgId(ctx)
      const patient = await ctx.db.patient.findFirst({ where: { id: input.patientId, orgId } })
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" })

      // Cascade in order (FK dependencies)
      await ctx.db.$transaction([
        ctx.db.communication.deleteMany({ where: { patientId: patient.id } }),
        ctx.db.avisGoogle.deleteMany({ where: { patientId: patient.id } }),
        ctx.db.formulaireReponse.deleteMany({ where: { patientId: patient.id } }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx.db as any).listeAttente.deleteMany({ where: { patientId: patient.id } }),
        ctx.db.facture.deleteMany({ where: { patientId: patient.id } }),
        ctx.db.rendezVous.deleteMany({ where: { patientId: patient.id } }),
        ctx.db.patient.delete({ where: { id: patient.id } }),
        ctx.db.logSuppression.create({ data: { orgId, motif: "Demande patient — droit à l'effacement" } }),
        ctx.db.auditLog.create({
          data: {
            orgId,
            userId: ctx.userId,
            entite: "Patient",
            entiteId: patient.id,
            action: "SUPPRESSION",
          },
        }),
      ])

      return { ok: true }
    }),

  // Audit log for a patient
  auditLog: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.auditLog.findMany({
        where: { orgId, entiteId: input.patientId },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    }),

  // All consents in the org
  consentements: protectedProcedure
    .input(z.object({ limit: z.number().int().max(200).default(100), offset: z.number().int().default(0) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const [items, total] = await Promise.all([
        ctx.db.patient.findMany({
          where: { orgId, consentementDate: { not: null } },
          orderBy: { consentementDate: "desc" },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            prenom: true,
            nom: true,
            telephone: true,
            consentementSMS: true,
            consentementCourriel: true,
            consentementDate: true,
          },
        }),
        ctx.db.patient.count({ where: { orgId, consentementDate: { not: null } } }),
      ])
      return { items, total }
    }),

  // Anonymized deletion log
  logSuppressions: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    return ctx.db.logSuppression.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  }),
})
