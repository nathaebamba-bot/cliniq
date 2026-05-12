import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

export const dashboardRouter = createTRPCRouter({
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const maintenant = new Date()
    const debutSemaine = startOfWeek(maintenant, { weekStartsOn: 1 })
    const finSemaine = endOfWeek(maintenant, { weekStartsOn: 1 })
    const semainePrecedenteDebut = subDays(debutSemaine, 7)
    const semainePrecedenteFin = subDays(finSemaine, 7)
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

    const [
      noShowsSemaine,
      noShowsSemPrecedente,
      rdvTotalSemaine,
      avisGoogle,
      parametres,
      // RDVs confirmed by patient this week (saved by reminders) with their invoice + typeRdv
      rdvsSauves,
    ] = await Promise.all([
      ctx.db.rendezVous.count({
        where: { orgId, statut: "NO_SHOW", dateHeure: { gte: debutSemaine, lte: finSemaine } },
      }),
      ctx.db.rendezVous.count({
        where: { orgId, statut: "NO_SHOW", dateHeure: { gte: semainePrecedenteDebut, lte: semainePrecedenteFin } },
      }),
      ctx.db.rendezVous.count({
        where: { orgId, dateHeure: { gte: debutSemaine, lte: finSemaine } },
      }),
      ctx.db.avisGoogle.count({
        where: { orgId, dateEnvoi: { gte: debutMois } },
      }),
      ctx.db.parametresClinique.findUnique({
        where: { orgId },
        select: { tarifMoyenConsultation: true },
      }),
      ctx.db.rendezVous.findMany({
        where: {
          orgId,
          confirmeParPatient: true,
          statut: { notIn: ["NO_SHOW", "ANNULE"] },
          dateHeure: { gte: debutSemaine, lte: finSemaine },
        },
        select: {
          typeRdv: true,
          facture: { select: { total: true, statut: true } },
        },
      }),
    ])

    // Load catalogue for typeRdv fallback (only types present in saved RDVs)
    const typesPresents = [...new Set(rdvsSauves.map((r) => r.typeRdv).filter(Boolean))] as string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catalogue: { typeRdv: string | null; prix: number }[] = typesPresents.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await (ctx.db as any).catalogueService.findMany({
          where: { orgId, actif: true, typeRdv: { in: typesPresents } },
          select: { typeRdv: true, prix: true },
        })
      : []

    const tarifFallback = parametres?.tarifMoyenConsultation ?? 150

    // Build a map typeRdv → sum of catalogue prices
    const tarifParType = new Map<string, number>()
    for (const s of catalogue) {
      if (!s.typeRdv) continue
      tarifParType.set(s.typeRdv, (tarifParType.get(s.typeRdv) ?? 0) + Number(s.prix))
    }

    // Calculate recovered revenue per saved RDV
    let revenusRecuperes = 0
    for (const rdv of rdvsSauves) {
      if (rdv.facture && rdv.facture.statut !== "ANNULE") {
        // Use actual invoice total
        revenusRecuperes += Number(rdv.facture.total)
      } else if (rdv.typeRdv && tarifParType.has(rdv.typeRdv)) {
        // Use catalogue sum for this appointment type
        revenusRecuperes += tarifParType.get(rdv.typeRdv)!
      } else {
        // Fallback to configured average rate
        revenusRecuperes += tarifFallback
      }
    }

    const rdvConfirmesSemaine = rdvsSauves.length
    const noShowsEvites = Math.max(0, noShowsSemPrecedente - noShowsSemaine)
    const tauxConfirmation = rdvTotalSemaine > 0
      ? Math.round((rdvConfirmesSemaine / rdvTotalSemaine) * 100)
      : 0

    return {
      noShowsSemaine,
      noShowsDelta: noShowsSemaine - noShowsSemPrecedente,
      rdvConfirmesSemaine,
      rdvTotalSemaine,
      tauxConfirmation,
      avisGoogle,
      noShowsEvites,
      tarifMoyenConsultation: tarifFallback,
      revenusRecuperes: Math.round(revenusRecuperes),
    }
  }),

  rdvDuJour: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const maintenant = new Date()
    const rdvs = await ctx.db.rendezVous.findMany({
      where: {
        orgId,
        dateHeure: { gte: startOfDay(maintenant), lte: endOfDay(maintenant) },
        statut: { notIn: ["ANNULE"] },
      },
      include: {
        patient: {
          select: {
            id: true, prenom: true, nom: true, telephone: true,
            rendezvous: {
              select: { statut: true },
              orderBy: { dateHeure: "desc" },
              take: 10,
              where: { dateHeure: { lt: startOfDay(maintenant) } },
            },
          },
        },
        praticien: { select: { id: true, prenom: true, nom: true, couleur: true } },
      },
      orderBy: { dateHeure: "asc" },
    })

    // Compute no-show risk score per patient (0-100)
    return rdvs.map((rdv) => {
      const historique = rdv.patient.rendezvous
      const total = historique.length
      const noShows = historique.filter((r) => r.statut === "NO_SHOW").length
      const tauxNoShow = total >= 2 ? noShows / total : 0
      // Risk: weighted by history depth + confirmation status
      const risk = total === 0 ? 20 // nouveau patient = risque modéré
        : Math.min(100, Math.round(tauxNoShow * 100 + (rdv.confirmeParPatient ? -20 : 10)))
      const { rendezvous: _, ...patientSansHistorique } = rdv.patient
      return { ...rdv, patient: patientSansHistorique, noShowRisk: risk }
    })
  }),

  actionsRequises: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const maintenant = new Date()
    const dans48h = new Date(maintenant.getTime() + 48 * 60 * 60 * 1000)
    const il6Mois = subDays(maintenant, 180)
    const il30Jours = subDays(maintenant, 30)

    const [sansFormulaire, traitementIncomplet, patientsInactifs] = await Promise.all([
      // RDV in next 48h without forms sent
      ctx.db.rendezVous.count({
        where: {
          orgId,
          formulaireEnvoye: false,
          statut: { notIn: ["ANNULE", "COMPLETE", "NO_SHOW"] },
          dateHeure: { gte: maintenant, lte: dans48h },
        },
      }),
      // Incomplete treatments > 30 days
      ctx.db.rendezVous.count({
        where: {
          orgId,
          traitementComplete: false,
          relanceEnvoyee: false,
          statut: "COMPLETE",
          dateHeure: { lte: il30Jours },
        },
      }),
      // Patients inactive > 6 months
      ctx.db.patient.count({
        where: {
          orgId,
          actif: true,
          rendezvous: {
            none: { dateHeure: { gte: il6Mois } },
          },
        },
      }),
    ])

    return { sansFormulaire, traitementIncomplet, patientsInactifs }
  }),

  activiteRecente: protectedProcedure
    .input(z.object({ limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.communication.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          patient: { select: { prenom: true, nom: true } },
        },
      })
    }),

  nonConfirmesAujourdhui: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const maintenant = new Date()
    return ctx.db.rendezVous.count({
      where: {
        orgId,
        dateHeure: { gte: startOfDay(maintenant), lte: endOfDay(maintenant) },
        statut: { notIn: ["ANNULE", "NO_SHOW", "COMPLETE", "ARRIVE"] },
        confirmeParPatient: false,
      },
    })
  }),

  noShowsParJour: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const debut = subDays(new Date(), 30)

    const rdvs = await ctx.db.rendezVous.findMany({
      where: { orgId, dateHeure: { gte: debut } },
      select: { dateHeure: true, statut: true, confirmeParPatient: true },
    })

    // Group by day
    const byDay = new Map<string, { date: string; noShows: number; confirmes: number; total: number }>()
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const key = d.toISOString().split("T")[0]
      byDay.set(key, { date: key, noShows: 0, confirmes: 0, total: 0 })
    }

    for (const rdv of rdvs) {
      const key = new Date(rdv.dateHeure).toISOString().split("T")[0]
      const entry = byDay.get(key)
      if (!entry) continue
      entry.total++
      if (rdv.statut === "NO_SHOW") entry.noShows++
      if (rdv.confirmeParPatient) entry.confirmes++
    }

    return Array.from(byDay.values())
  }),
})
