import { z } from "zod/v3"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"

export const praticienRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organisation.findUnique({ where: { clerkOrgId: ctx.orgId }, select: { id: true } })
    if (!org) return []
    return ctx.db.praticien.findMany({ where: { orgId: org.id, actif: true }, orderBy: { nom: "asc" } })
  }),

  create: adminProcedure
    .input(
      z.object({
        prenom: z.string().min(1),
        nom: z.string().min(1),
        titre: z.string().optional(),
        specialite: z.string().optional(),
        courriel: z.string().email().optional().or(z.literal("")),
        telephone: z.string().optional(),
        couleur: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organisation.findUnique({ where: { clerkOrgId: ctx.orgId }, select: { id: true } })
      if (!org) throw new Error("Organisation introuvable")
      return ctx.db.praticien.create({ data: { orgId: org.id, ...input } })
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), prenom: z.string().min(1).optional(), nom: z.string().min(1).optional(), titre: z.string().optional(), specialite: z.string().optional(), courriel: z.string().email().optional().or(z.literal("")), telephone: z.string().optional(), couleur: z.string().optional(), actif: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organisation.findUnique({ where: { clerkOrgId: ctx.orgId }, select: { id: true } })
      if (!org) throw new Error("Organisation introuvable")
      const { id, ...data } = input
      return ctx.db.praticien.update({ where: { id, orgId: org.id }, data })
    }),

  supprimer: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organisation.findUnique({ where: { clerkOrgId: ctx.orgId }, select: { id: true } })
      if (!org) throw new Error("Organisation introuvable")
      return ctx.db.praticien.update({ where: { id: input.id, orgId: org.id }, data: { actif: false } })
    }),
})
