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

export const listeAttenteRouter = createTRPCRouter({
  liste: protectedProcedure
    .input(z.object({ statut: z.enum(["EN_ATTENTE", "NOTIFIE", "CONVERTI", "ANNULE"]).optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.db as any).listeAttente.findMany({
        where: { orgId, statut: input.statut ?? "EN_ATTENTE" },
        include: {
          patient: { select: { id: true, prenom: true, nom: true, telephone: true, courriel: true } },
          praticien: { select: { id: true, prenom: true, nom: true, couleur: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    }),

  ajouter: protectedProcedure
    .input(z.object({
      patientId: z.string(),
      praticienId: z.string().optional(),
      typeRdv: z.string().optional(),
      dureeMinutes: z.number().int().min(15).max(480).default(60),
      notes: z.string().optional(),
      joursDisponibles: z.array(z.string()).optional(),
      heureDebut: z.string().optional(),
      heureFin: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.db as any).listeAttente.create({
        data: { orgId, ...input, joursDisponibles: input.joursDisponibles ?? [] },
      })
    }),

  notifier: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = await (ctx.db as any).listeAttente.findFirst({
        where: { id: input.id, orgId },
        include: {
          patient: { select: { prenom: true, nom: true, telephone: true, consentementSMS: true } },
          organisation: { select: { nom: true, telephone: true } },
        },
      })
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" })

      let smsSent = false
      if (entry.patient.consentementSMS && entry.patient.telephone) {
        try {
          const { envoyerSMS } = await import("@/lib/twilio")
          await envoyerSMS(
            entry.patient.telephone,
            `Bonjour ${entry.patient.prenom}! Un créneau s'est libéré à ${entry.organisation.nom}. Appelez-nous vite au ${entry.organisation.telephone} pour réserver votre place. Merci!`
          )
          smsSent = true
        } catch {
          // Non-blocking
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.db as any).listeAttente.update({
        where: { id: input.id },
        data: { statut: "NOTIFIE", notifieLe: new Date() },
      })

      return { smsSent }
    }),

  convertir: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.db as any).listeAttente.updateMany({
        where: { id: input.id, orgId },
        data: { statut: "CONVERTI" },
      })
    }),

  retirer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.db as any).listeAttente.updateMany({
        where: { id: input.id, orgId },
        data: { statut: "ANNULE" },
      })
    }),
})
