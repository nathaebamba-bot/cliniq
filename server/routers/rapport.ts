import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { startOfMonth, endOfMonth, subMonths, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const rapportRouter = createTRPCRouter({
  mensuel: protectedProcedure
    .input(z.object({
      annee: z.number().int().optional(),
      mois: z.number().int().min(1).max(12).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const now = new Date()
      const annee = input.annee ?? now.getFullYear()
      const mois = (input.mois ?? now.getMonth() + 1) - 1
      const debut = startOfMonth(new Date(annee, mois, 1))
      const fin = endOfMonth(new Date(annee, mois, 1))

      const [
        totalRdv,
        noShows,
        confirmes,
        formulairesComplete,
        relancesEnvoyees,
        avisEnvoyes,
        parametres,
      ] = await Promise.all([
        ctx.db.rendezVous.count({ where: { orgId, dateHeure: { gte: debut, lte: fin } } }),
        ctx.db.rendezVous.count({ where: { orgId, statut: "NO_SHOW", dateHeure: { gte: debut, lte: fin } } }),
        ctx.db.rendezVous.count({ where: { orgId, confirmeParPatient: true, dateHeure: { gte: debut, lte: fin } } }),
        ctx.db.formulaireReponse.count({ where: { formulaire: { orgId }, completeLe: { gte: debut, lte: fin } } }),
        ctx.db.rendezVous.count({ where: { orgId, relanceEnvoyee: true, updatedAt: { gte: debut, lte: fin } } }),
        ctx.db.avisGoogle.count({ where: { orgId, dateEnvoi: { gte: debut, lte: fin } } }),
        ctx.db.parametresClinique.findUnique({ where: { orgId }, select: { tarifMoyenConsultation: true } }),
      ])

      const tarif = parametres?.tarifMoyenConsultation ?? 150
      const tauxNoShow = totalRdv > 0 ? Math.round((noShows / totalRdv) * 100) : 0
      const tauxConfirmation = totalRdv > 0 ? Math.round((confirmes / totalRdv) * 100) : 0
      const noShowsEvites = Math.max(0, confirmes - noShows)

      return {
        totalRdv,
        noShows,
        tauxNoShow,
        confirmes,
        tauxConfirmation,
        noShowsEvites,
        revenusRecuperes: noShowsEvites * tarif,
        formulairesComplete,
        relancesEnvoyees,
        avisEnvoyes,
      }
    }),

  noShowsParSemaine: protectedProcedure
    .input(z.object({ moisPasses: z.number().int().min(1).max(12).default(3) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const debut = startOfMonth(subMonths(new Date(), input.moisPasses - 1))
      const fin = endOfMonth(new Date())

      const rdvs = await ctx.db.rendezVous.findMany({
        where: { orgId, dateHeure: { gte: debut, lte: fin } },
        select: { dateHeure: true, statut: true },
      })

      const semaines = eachWeekOfInterval({ start: debut, end: fin }, { weekStartsOn: 1 })
      const result = semaines.map((semDebut) => {
        const semFin = endOfWeek(semDebut, { weekStartsOn: 1 })
        const rdvsSem = rdvs.filter((r) => {
          const d = new Date(r.dateHeure)
          return d >= semDebut && d <= semFin
        })
        return {
          semaine: semDebut.toISOString().split("T")[0],
          total: rdvsSem.length,
          noShows: rdvsSem.filter((r) => r.statut === "NO_SHOW").length,
        }
      })

      return result
    }),

  repartitionStatuts: protectedProcedure
    .input(z.object({
      annee: z.number().int().optional(),
      mois: z.number().int().min(1).max(12).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const now = new Date()
      const annee = input.annee ?? now.getFullYear()
      const mois = (input.mois ?? now.getMonth() + 1) - 1
      const debut = startOfMonth(new Date(annee, mois, 1))
      const fin = endOfMonth(new Date(annee, mois, 1))

      const rdvs = await ctx.db.rendezVous.findMany({
        where: { orgId, dateHeure: { gte: debut, lte: fin } },
        select: { statut: true },
      })

      const counts: Record<string, number> = {}
      for (const rdv of rdvs) {
        counts[rdv.statut] = (counts[rdv.statut] ?? 0) + 1
      }

      return Object.entries(counts).map(([statut, count]) => ({ statut, count }))
    }),

  avisParMois: protectedProcedure
    .input(z.object({ moisPasses: z.number().int().min(1).max(12).default(6) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const result = []
      for (let i = input.moisPasses - 1; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const debut = startOfMonth(d)
        const fin = endOfMonth(d)
        const count = await ctx.db.avisGoogle.count({
          where: { orgId, dateEnvoi: { gte: debut, lte: fin } },
        })
        result.push({
          mois: debut.toISOString().split("T")[0],
          count,
        })
      }
      return result
    }),

  statsParPraticien: protectedProcedure
    .input(z.object({
      annee: z.number().int().optional(),
      mois: z.number().int().min(1).max(12).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const now = new Date()
      const annee = input.annee ?? now.getFullYear()
      const mois = (input.mois ?? now.getMonth() + 1) - 1
      const debut = startOfMonth(new Date(annee, mois, 1))
      const fin = endOfMonth(new Date(annee, mois, 1))

      const [praticiens, rdvs, parametres] = await Promise.all([
        ctx.db.praticien.findMany({
          where: { orgId },
          select: { id: true, prenom: true, nom: true, couleur: true, specialite: true },
          orderBy: { nom: "asc" },
        }),
        ctx.db.rendezVous.findMany({
          where: { orgId, dateHeure: { gte: debut, lte: fin } },
          select: { praticienId: true, statut: true, confirmeParPatient: true },
        }),
        ctx.db.parametresClinique.findUnique({ where: { orgId }, select: { tarifMoyenConsultation: true } }),
      ])

      const tarif = parametres?.tarifMoyenConsultation ?? 150

      return praticiens.map((p) => {
        const rdvsPrat = rdvs.filter((r) => r.praticienId === p.id)
        const total = rdvsPrat.length
        const noShows = rdvsPrat.filter((r) => r.statut === "NO_SHOW").length
        const confirmes = rdvsPrat.filter((r) => r.confirmeParPatient).length
        const completes = rdvsPrat.filter((r) => r.statut === "COMPLETE").length
        return {
          id: p.id,
          prenom: p.prenom,
          nom: p.nom,
          couleur: p.couleur,
          specialite: p.specialite,
          total,
          noShows,
          tauxNoShow: total > 0 ? Math.round((noShows / total) * 100) : 0,
          confirmes,
          tauxConfirmation: total > 0 ? Math.round((confirmes / total) * 100) : 0,
          completes,
          revenusRecuperes: Math.max(0, confirmes - noShows) * tarif,
        }
      }).filter((p) => p.total > 0)
    }),
})
