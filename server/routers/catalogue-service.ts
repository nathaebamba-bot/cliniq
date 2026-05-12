import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"

type PrismaDb = import("@prisma/client").PrismaClient
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cs = (db: PrismaDb) => (db as any).catalogueService

async function getOrgId(ctx: { db: PrismaDb; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

const serviceInput = z.object({
  nom: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  prix: z.number().min(0).max(99999),
  codeFacturation: z.string().max(50).optional(),
  typeRdv: z.string().max(100).optional(),
})

export const catalogueServiceRouter = createTRPCRouter({
  liste: protectedProcedure
    .input(z.object({ actifSeulement: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return cs(ctx.db).findMany({
        where: { orgId, ...(input.actifSeulement ? { actif: true } : {}) },
        orderBy: [{ typeRdv: "asc" }, { nom: "asc" }],
      })
    }),

  creer: adminProcedure
    .input(serviceInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return cs(ctx.db).create({ data: { orgId, ...input } })
    }),

  modifier: adminProcedure
    .input(z.object({ id: z.string() }).merge(serviceInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const orgId = await getOrgId(ctx)
      const existing = await cs(ctx.db).findFirst({ where: { id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return cs(ctx.db).update({ where: { id }, data })
    }),

  toggleActif: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await cs(ctx.db).findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return cs(ctx.db).update({ where: { id: input.id }, data: { actif: !existing.actif } })
    }),

  supprimer: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await cs(ctx.db).findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return cs(ctx.db).delete({ where: { id: input.id } })
    }),
})
