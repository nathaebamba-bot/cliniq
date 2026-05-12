import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, publicProcedure, createTRPCRouter } from "@/server/trpc"
import { FORMULAIRES_PREBUILTS } from "@/lib/formulaires-prebuilts"
import type { Question } from "@/types/formulaire"
import { addHours } from "date-fns"
import { randomUUID } from "crypto"
import { rateLimitPublicForm } from "@/lib/rate-limit"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org.id
}

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["text-court", "text-long", "oui-non", "choix-multiple", "cases-cocher", "echelle", "date", "section"]),
  question: z.string(),
  obligatoire: z.boolean(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
  condition: z.object({ questionId: z.string(), reponse: z.string() }).optional(),
})

export const formulaireRouter = createTRPCRouter({
  // ── Dashboard routes ───────────────────────────────────────────────────────

  liste: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    return ctx.db.formulaire.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { reponses: true } } },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const f = await ctx.db.formulaire.findFirst({
        where: { id: input.id, orgId },
        include: {
          reponses: {
            include: { patient: { select: { prenom: true, nom: true, telephone: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      })
      if (!f) throw new TRPCError({ code: "NOT_FOUND" })
      return f
    }),

  create: protectedProcedure
    .input(z.object({
      nom: z.string().min(1),
      type: z.enum(["DENTAIRE", "PHYSIOTHERAPIE", "PSYCHOLOGIE", "MASSOTHERAPIE", "OPTOMETRIE", "MEDECINE_GENERALE", "AUTRE"]),
      questions: z.array(questionSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      return ctx.db.formulaire.create({
        data: { ...input, orgId },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      nom: z.string().min(1).optional(),
      questions: z.array(questionSchema).optional(),
      actif: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.formulaire.findFirst({ where: { id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.formulaire.update({ where: { id }, data })
    }),

  supprimer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const existing = await ctx.db.formulaire.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.formulaire.delete({ where: { id: input.id } })
    }),

  // Seed the 3 pre-built forms if not already present
  seedPrebuilts: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = await getOrgId(ctx)
    const org = await ctx.db.organisation.findUnique({ where: { id: orgId } })
    if (!org) throw new TRPCError({ code: "NOT_FOUND" })

    const existingCount = await ctx.db.formulaire.count({ where: { orgId } })
    if (existingCount > 0) return { created: 0 }

    const relevant = FORMULAIRES_PREBUILTS.filter(
      (f) => f.type === org.type || org.type === "AUTRE"
    )
    const toCreate = relevant.length > 0 ? relevant : FORMULAIRES_PREBUILTS

    await ctx.db.formulaire.createMany({
      data: toCreate.map((f) => ({
        orgId,
        nom: f.nom,
        type: f.type,
        actif: true,
        questions: f.questions as unknown as import("@prisma/client").Prisma.InputJsonValue,
      })),
    })

    return { created: toCreate.length }
  }),

  // Generate a shareable token for a patient
  genererLien: protectedProcedure
    .input(z.object({
      formulaireId: z.string(),
      patientId: z.string(),
      rendezvousId: z.string().optional(),
      expiresInHours: z.number().default(72),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)
      const f = await ctx.db.formulaire.findFirst({ where: { id: input.formulaireId, orgId } })
      if (!f) throw new TRPCError({ code: "NOT_FOUND" })

      const token = randomUUID()
      const expireA = addHours(new Date(), input.expiresInHours)

      const reponse = await ctx.db.formulaireReponse.create({
        data: {
          formulaireId: input.formulaireId,
          patientId: input.patientId,
          rendezvousId: input.rendezvousId ?? null,
          reponses: {} as import("@prisma/client").Prisma.InputJsonValue,
          lienToken: token,
          expireA,
        },
      })

      const url = `${process.env.NEXT_PUBLIC_APP_URL}/f/${token}`
      return { token, url, expireA }
    }),

  // Send a form link to a patient via SMS/email (manual trigger)
  envoyerAuPatient: protectedProcedure
    .input(z.object({
      formulaireId: z.string().min(1),
      patientId: z.string().min(1),
      rendezvousId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgId(ctx)

      const [formulaire, patient, org] = await Promise.all([
        ctx.db.formulaire.findFirst({ where: { id: input.formulaireId, orgId } }),
        ctx.db.patient.findFirst({ where: { id: input.patientId, orgId } }),
        ctx.db.organisation.findUnique({ where: { id: orgId }, select: { nom: true, couleurPrimaire: true, telephone: true } }),
      ])
      if (!formulaire) throw new TRPCError({ code: "NOT_FOUND", message: "Formulaire introuvable" })
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" })

      // Return existing pending form if sent within last 24h and not yet completed
      const existing = await ctx.db.formulaireReponse.findFirst({
        where: {
          formulaireId: input.formulaireId,
          patientId: input.patientId,
          completeLe: null,
          expireA: { gt: new Date() },
          createdAt: { gt: addHours(new Date(), -24) },
        },
        orderBy: { createdAt: "desc" },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

      if (existing) {
        const url = `${appUrl}/f/${existing.lienToken}`
        return { url, smsSent: false, emailSent: false, alreadyExists: true }
      }

      const token = randomUUID()
      const expireA = addHours(new Date(), 72)

      await ctx.db.formulaireReponse.create({
        data: {
          formulaireId: input.formulaireId,
          patientId: input.patientId,
          rendezvousId: input.rendezvousId ?? null,
          reponses: {} as import("@prisma/client").Prisma.InputJsonValue,
          lienToken: token,
          expireA,
        },
      })

      // Mark RDV so the auto-job doesn't re-send
      if (input.rendezvousId) {
        await ctx.db.rendezVous.update({
          where: { id: input.rendezvousId },
          data: { formulaireEnvoye: true },
        }).catch(() => null)
      }

      const url = `${appUrl}/f/${token}`
      let smsSent = false
      let emailSent = false
      let smsError: string | undefined

      // ── SMS ───────────────────────────────────────────────────────────────
      if (patient.consentementSMS && patient.telephone) {
        try {
          const { envoyerSMS } = await import("@/lib/twilio")
          const msg = patient.langue === "EN"
            ? `Hello ${patient.prenom}, please complete your health form: ${url}`
            : `Bonjour ${patient.prenom}, veuillez remplir votre formulaire de santé : ${url}`
          const sid = await envoyerSMS(patient.telephone, msg)
          await ctx.db.communication.create({
            data: {
              orgId, patientId: input.patientId, rendezvousId: input.rendezvousId ?? null,
              type: "FORMULAIRE_ANAMNE", canal: "SMS", statut: "ENVOYE",
              contenu: msg, twilioSid: sid, envoyeLe: new Date(),
            },
          })
          smsSent = true
        } catch (err) {
          smsError = err instanceof Error ? err.message : "Erreur Twilio"
          await ctx.db.communication.create({
            data: {
              orgId, patientId: input.patientId, rendezvousId: input.rendezvousId ?? null,
              type: "FORMULAIRE_ANAMNE", canal: "SMS", statut: "ECHEC",
              contenu: `Échec: ${smsError}`, envoyeLe: new Date(),
            },
          })
        }
      }

      // ── Courriel ─────────────────────────────────────────────────────────
      if (patient.consentementCourriel && patient.courriel) {
        try {
          const { createElement } = await import("react")
          const { FormulaireEmail } = await import("@/emails/formulaire-anamne")
          const { resend, FROM } = await import("@/lib/resend")
          const sujet = patient.langue === "EN"
            ? `Your health form — please complete before your visit`
            : `Votre formulaire de santé — à compléter avant votre visite`
          const { data, error } = await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: patient.courriel,
            subject: sujet,
            react: createElement(FormulaireEmail, {
              prenom: patient.prenom, nomFormulaire: formulaire.nom, lien: url,
              clinique: org?.nom ?? "Cliniq",
              couleur: org?.couleurPrimaire ?? "#2563EB",
              telephone: org?.telephone,
              langue: patient.langue,
            }),
          })
          if (error) throw new Error(error.message)
          await ctx.db.communication.create({
            data: {
              orgId, patientId: input.patientId, rendezvousId: input.rendezvousId ?? null,
              type: "FORMULAIRE_ANAMNE", canal: "COURRIEL", statut: "ENVOYE",
              sujet, contenu: sujet, resendId: data?.id, envoyeLe: new Date(),
            },
          })
          emailSent = true
        } catch {
          // email failure doesn't block the response — URL is still usable
        }
      }

      return { url, smsSent, emailSent, smsError, alreadyExists: false }
    }),

  // ── Public routes (no auth) ────────────────────────────────────────────────

  // Called by public form page to load form by token
  chargerFormulaire: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rl = rateLimitPublicForm(ctx.ip)
      if (!rl.success) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de requêtes. Réessayez dans une minute." })

      const reponse = await ctx.db.formulaireReponse.findUnique({
        where: { lienToken: input.token },
        include: {
          formulaire: true,
          patient: { select: { prenom: true, nom: true, langue: true } },
        },
      })

      if (!reponse) throw new TRPCError({ code: "NOT_FOUND", message: "Lien invalide" })
      if (new Date() > reponse.expireA) throw new TRPCError({ code: "NOT_FOUND", message: "Lien expiré" })

      const formulaire = reponse.formulaire

      // Load org + RDV date in parallel
      const [org, rdv] = await Promise.all([
        ctx.db.organisation.findUnique({
          where: { id: formulaire.orgId },
          select: { nom: true, couleurPrimaire: true, telephone: true },
        }),
        reponse.rendezvousId
          ? ctx.db.rendezVous.findUnique({
              where: { id: reponse.rendezvousId },
              select: { dateHeure: true, dureeMinutes: true, typeRdv: true },
            })
          : null,
      ])

      return {
        reponse: {
          id: reponse.id,
          completeLe: reponse.completeLe,
          expireA: reponse.expireA,
        },
        formulaire: {
          id: formulaire.id,
          nom: formulaire.nom,
          questions: formulaire.questions as unknown as Question[],
        },
        patient: reponse.patient,
        org,
        rdv: rdv ? {
          dateHeure: rdv.dateHeure,
          dureeMinutes: rdv.dureeMinutes,
          typeRdv: rdv.typeRdv,
        } : null,
      }
    }),

  soumettre: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
      reponses: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const rl = rateLimitPublicForm(ctx.ip)
      if (!rl.success) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de requêtes. Réessayez dans une minute." })

      // Cap reponses payload size to prevent abuse
      const reponsesStr = JSON.stringify(input.reponses)
      if (reponsesStr.length > 50_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Données trop volumineuses." })

      const reponse = await ctx.db.formulaireReponse.findUnique({
        where: { lienToken: input.token },
      })
      if (!reponse) throw new TRPCError({ code: "NOT_FOUND" })
      if (new Date() > reponse.expireA) throw new TRPCError({ code: "NOT_FOUND", message: "Lien expiré" })
      if (reponse.completeLe) throw new TRPCError({ code: "CONFLICT", message: "Formulaire déjà soumis" })

      const updated = await ctx.db.formulaireReponse.update({
        where: { id: reponse.id },
        data: {
          reponses: input.reponses as import("@prisma/client").Prisma.InputJsonValue,
          completeLe: new Date(),
        },
      })

      // Mark the linked RDV so the automated job doesn't re-send
      if (reponse.rendezvousId) {
        await ctx.db.rendezVous.update({
          where: { id: reponse.rendezvousId },
          data: { formulaireEnvoye: true },
        }).catch(() => null)
      }

      return updated
    }),
})
