import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"
import { Sexe, Langue, AssuranceStatut } from "@prisma/client"

const patientInput = z.object({
  prenom: z.string().min(1).max(100),
  nom: z.string().min(1).max(100),
  dateNaissance: z.string().optional().nullable(),
  sexe: z.nativeEnum(Sexe).optional().nullable(),
  telephone: z.string().min(1).max(20),
  courriel: z.string().email().optional().or(z.literal("")).nullable(),
  langue: z.nativeEnum(Langue).default("FR"),
  consentementSMS: z.boolean().default(false),
  consentementCourriel: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  alertes: z.string().optional().nullable(),
  assuranceStatut: z.nativeEnum(AssuranceStatut).optional().nullable(),
  assuranceNom: z.string().optional().nullable(),
  assuranceNumPolice: z.string().optional().nullable(),
  assuranceNumMembre: z.string().optional().nullable(),
  assuranceConsente: z.boolean().optional(),
})

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation introuvable" })
  return org.id
}

export const patientRouter = createTRPCRouter({
  liste: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        recherche: z.string().optional(),
        actif: z.boolean().optional(),
        langue: z.nativeEnum(Langue).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const where = {
        orgId,
        ...(input.actif !== undefined ? { actif: input.actif } : {}),
        ...(input.langue ? { langue: input.langue } : {}),
        ...(input.recherche
          ? {
              OR: [
                { prenom: { contains: input.recherche, mode: "insensitive" as const } },
                { nom: { contains: input.recherche, mode: "insensitive" as const } },
                { telephone: { contains: input.recherche } },
                { courriel: { contains: input.recherche, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }

      const [patients, total] = await Promise.all([
        ctx.db.patient.findMany({
          where,
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
          orderBy: [{ nom: "asc" }, { prenom: "asc" }],
          include: {
            _count: { select: { rendezvous: true, communications: true } },
            rendezvous: {
              orderBy: { dateHeure: "desc" },
              take: 1,
              select: { dateHeure: true, statut: true },
            },
          },
        }),
        ctx.db.patient.count({ where }),
      ])

      return { patients, total, pages: Math.ceil(total / input.perPage) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)

      const patient = await ctx.db.patient.findFirst({
        where: { id: input.id, orgId },
        include: {
          rendezvous: {
            orderBy: { dateHeure: "desc" },
            include: { praticien: true },
          },
          communications: {
            orderBy: { createdAt: "desc" },
            take: 100,
          },
          formulaires: {
            include: { formulaire: true },
            orderBy: { createdAt: "desc" },
          },
          avisGoogle: { orderBy: { createdAt: "desc" } },
        },
      })
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" })
      return patient
    }),

  create: protectedProcedure.input(patientInput).mutation(async ({ ctx, input }) => {
    const orgId = await getOrgId(ctx)
    const { dateNaissance, ...rest } = input
    return ctx.db.patient.create({
      data: {
        ...rest,
        orgId,
        courriel: input.courriel || null,
        notes: input.notes || null,
        alertes: input.alertes || null,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        consentementDate:
          input.consentementSMS || input.consentementCourriel ? new Date() : null,
      },
    })
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(patientInput))
    .mutation(async ({ ctx, input }) => {
      const { id, dateNaissance, ...data } = input
      const orgId = await getOrgId(ctx)

      const existing = await ctx.db.patient.findFirst({ where: { id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })

      const updated = await ctx.db.patient.update({
        where: { id },
        data: {
          ...data,
          courriel: data.courriel || null,
          notes: data.notes || null,
          alertes: data.alertes || null,
          dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        },
      })

      await ctx.db.auditLog.create({
        data: {
          orgId,
          userId: ctx.userId,
          entite: "Patient",
          entiteId: id,
          action: "MODIFICATION",
          ancienneValeur: existing as unknown as import("@prisma/client").Prisma.InputJsonValue,
          nouvelleValeur: updated as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      })

      return updated
    }),

  archiver: adminProcedure
    .input(z.object({ id: z.string(), actif: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.patient.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.patient.update({ where: { id: input.id }, data: { actif: input.actif } })
    }),

  importerCSV: protectedProcedure
    .input(
      z.object({
        patients: z
          .array(
            z.object({
              prenom: z.string().min(1).max(100),
              nom: z.string().min(1).max(100),
              telephone: z.string().min(1).max(20),
              courriel: z.string().email().optional().or(z.literal("")).nullable(),
              dateNaissance: z.string().optional().nullable(),
              langue: z.nativeEnum(Langue).default("FR"),
              consentementSMS: z.boolean().default(false),
              consentementCourriel: z.boolean().default(false),
              notes: z.string().optional().nullable(),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const now = new Date()
      await ctx.db.patient.createMany({
        data: input.patients.map((p) => ({
          orgId,
          prenom: p.prenom,
          nom: p.nom,
          telephone: p.telephone,
          courriel: p.courriel || null,
          dateNaissance: p.dateNaissance ? new Date(p.dateNaissance) : null,
          langue: p.langue,
          consentementSMS: p.consentementSMS,
          consentementCourriel: p.consentementCourriel,
          notes: p.notes || null,
          consentementDate: p.consentementSMS || p.consentementCourriel ? now : null,
        })),
        skipDuplicates: true,
      })
      return { importe: input.patients.length }
    }),
})
