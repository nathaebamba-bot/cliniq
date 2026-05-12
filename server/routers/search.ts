import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { addDays, startOfDay } from "date-fns"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const searchRouter = createTRPCRouter({
  global: protectedProcedure
    .input(z.object({ q: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const q = input.q.trim()

      const [patients, rdvs] = await Promise.all([
        ctx.db.patient.findMany({
          where: {
            orgId,
            OR: [
              { nom: { contains: q, mode: "insensitive" } },
              { prenom: { contains: q, mode: "insensitive" } },
              { telephone: { contains: q } },
              { courriel: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, prenom: true, nom: true, telephone: true, courriel: true, actif: true },
          take: 8,
          orderBy: [{ actif: "desc" }, { nom: "asc" }],
        }),
        ctx.db.rendezVous.findMany({
          where: {
            orgId,
            dateHeure: { gte: startOfDay(new Date()), lte: addDays(new Date(), 14) },
            statut: { notIn: ["ANNULE", "NO_SHOW"] },
            OR: [
              { patient: { nom: { contains: q, mode: "insensitive" } } },
              { patient: { prenom: { contains: q, mode: "insensitive" } } },
              { patient: { telephone: { contains: q } } },
            ],
          },
          select: {
            id: true,
            dateHeure: true,
            statut: true,
            confirmeParPatient: true,
            patient: { select: { id: true, prenom: true, nom: true } },
            praticien: { select: { prenom: true, nom: true } },
          },
          take: 5,
          orderBy: { dateHeure: "asc" },
        }),
      ])

      return { patients, rdvs }
    }),
})
