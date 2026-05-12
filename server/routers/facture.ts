import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/server/trpc"
import { StatutFacture } from "@prisma/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

async function getOrgId(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({
    where: { clerkOrgId: ctx.orgId },
    select: { id: true, nom: true, telephone: true, courriel: true },
  })
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation introuvable" })
  return org
}

async function genNumero(db: import("@prisma/client").PrismaClient, orgId: string): Promise<string> {
  const count = await db.facture.count({ where: { orgId } })
  const year = new Date().getFullYear()
  return `FAC-${year}-${String(count + 1).padStart(4, "0")}`
}

const ligneSchema = z.object({
  description: z.string().min(1).max(200),
  montant: z.number().min(0).max(99999),
})

export const factureRouter = createTRPCRouter({
  liste: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(100).default(25),
      statut: z.nativeEnum(StatutFacture).optional(),
      patientId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const where = {
        orgId,
        ...(input.statut ? { statut: input.statut } : {}),
        ...(input.patientId ? { patientId: input.patientId } : {}),
      }
      const [factures, total] = await Promise.all([
        ctx.db.facture.findMany({
          where,
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
          orderBy: { createdAt: "desc" },
          include: {
            patient: { select: { prenom: true, nom: true, courriel: true, telephone: true } },
            rendezvous: { select: { dateHeure: true, typeRdv: true } },
          },
        }),
        ctx.db.facture.count({ where }),
      ])
      return { factures, total, pages: Math.ceil(total / input.perPage) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const facture = await ctx.db.facture.findFirst({
        where: { id: input.id, orgId },
        include: {
          patient: { select: { prenom: true, nom: true, courriel: true, telephone: true } },
          rendezvous: { select: { dateHeure: true, typeRdv: true, praticien: { select: { prenom: true, nom: true } } } },
          organisation: { select: { nom: true, adresse: true, ville: true, telephone: true, couleurPrimaire: true } },
        },
      })
      if (!facture) throw new TRPCError({ code: "NOT_FOUND" })
      return facture
    }),

  creer: protectedProcedure
    .input(z.object({
      patientId: z.string(),
      rendezvousId: z.string().optional(),
      lignes: z.array(ligneSchema).min(1),
      taxes: z.number().min(0).max(9999).default(0),
      notes: z.string().optional(),
      destCourriel: z.string().email().optional().or(z.literal("")),
      destNom: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const numero = await genNumero(ctx.db, orgId)
      const sousTotal = input.lignes.reduce((s, l) => s + l.montant, 0)
      const total = sousTotal + input.taxes
      return ctx.db.facture.create({
        data: {
          orgId,
          patientId: input.patientId,
          rendezvousId: input.rendezvousId ?? null,
          numero,
          lignes: input.lignes,
          sousTotal,
          taxes: input.taxes,
          total,
          notes: input.notes ?? null,
          destCourriel: input.destCourriel || null,
          destNom: input.destNom ?? null,
        },
        include: { patient: { select: { prenom: true, nom: true } } },
      })
    }),

  modifier: protectedProcedure
    .input(z.object({
      id: z.string(),
      lignes: z.array(ligneSchema).min(1).optional(),
      taxes: z.number().min(0).max(9999).optional(),
      notes: z.string().optional(),
      destCourriel: z.string().email().optional().or(z.literal("")),
      destNom: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const existing = await ctx.db.facture.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      if (existing.statut === "PAYE") throw new TRPCError({ code: "BAD_REQUEST", message: "Facture déjà payée." })

      const lignes = input.lignes ?? (existing.lignes as { description: string; montant: number }[])
      const taxes = input.taxes ?? Number(existing.taxes)
      const sousTotal = lignes.reduce((s, l) => s + l.montant, 0)
      const total = sousTotal + taxes

      return ctx.db.facture.update({
        where: { id: input.id },
        data: {
          lignes,
          sousTotal,
          taxes,
          total,
          notes: input.notes ?? existing.notes,
          destCourriel: input.destCourriel !== undefined ? (input.destCourriel || null) : existing.destCourriel,
          destNom: input.destNom ?? existing.destNom,
        },
      })
    }),

  envoyer: protectedProcedure
    .input(z.object({
      id: z.string(),
      canal: z.enum(["EMAIL", "SMS", "LES_DEUX"]).default("EMAIL"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const facture = await ctx.db.facture.findFirst({
        where: { id: input.id, orgId },
        include: {
          patient: { select: { prenom: true, nom: true, courriel: true, telephone: true, consentementSMS: true, consentementCourriel: true } },
          organisation: { select: { nom: true, telephone: true, courriel: true, couleurPrimaire: true } },
          rendezvous: { select: { dateHeure: true, typeRdv: true } },
        },
      })
      if (!facture) throw new TRPCError({ code: "NOT_FOUND" })
      if (facture.statut === "ANNULE") throw new TRPCError({ code: "BAD_REQUEST", message: "Facture annulée." })

      const dest = facture.destCourriel || facture.patient.courriel
      const destTel = facture.patient.telephone
      const dateStr = facture.rendezvous?.dateHeure
        ? format(new Date(facture.rendezvous.dateHeure), "d MMMM yyyy", { locale: fr })
        : format(new Date(), "d MMMM yyyy", { locale: fr })

      const errors: string[] = []
      let sent = false

      if ((input.canal === "EMAIL" || input.canal === "LES_DEUX") && dest) {
        try {
          const { resend, FROM } = await import("@/lib/resend")
          const lignes = facture.lignes as { description: string; montant: number }[]
          const lignesHtml = lignes.map((l) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${l.description}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${l.montant.toFixed(2)} $</td></tr>`
          ).join("")
          const html = `
<div style="font-family:DM Sans,sans-serif;max-width:600px;margin:0 auto;padding:32px">
  <div style="background:${facture.organisation.couleurPrimaire ?? "#2563EB"};padding:24px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">${facture.organisation.nom}</h1>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0">Facture ${facture.numero}</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:0">
    <p>Bonjour ${facture.destNom ?? facture.patient.prenom},</p>
    <p>Veuillez trouver ci-joint votre facture pour votre visite du <strong>${dateStr}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Service</th><th style="padding:8px;text-align:right">Montant</th></tr></thead>
      <tbody>${lignesHtml}</tbody>
      <tfoot>
        <tr><td style="padding:8px;text-align:right">Sous-total:</td><td style="padding:8px;text-align:right">${Number(facture.sousTotal).toFixed(2)} $</td></tr>
        <tr><td style="padding:8px;text-align:right">Taxes:</td><td style="padding:8px;text-align:right">${Number(facture.taxes).toFixed(2)} $</td></tr>
        <tr style="font-weight:bold;background:#f1f5f9"><td style="padding:8px;text-align:right">Total:</td><td style="padding:8px;text-align:right">${Number(facture.total).toFixed(2)} $</td></tr>
      </tfoot>
    </table>
    ${facture.notes ? `<p style="color:#64748b;font-size:14px">${facture.notes}</p>` : ""}
    <p style="font-size:13px;color:#94a3b8">Pour toute question: ${facture.organisation.telephone ?? ""} · ${facture.organisation.courriel ?? ""}</p>
  </div>
</div>`
          await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: dest,
            subject: `Facture ${facture.numero} — ${facture.organisation.nom}`,
            html,
          })
          sent = true
        } catch (e) {
          errors.push(`Courriel: ${String(e)}`)
        }
      }

      if ((input.canal === "SMS" || input.canal === "LES_DEUX") && destTel && facture.patient.consentementSMS) {
        try {
          const { envoyerSMS } = await import("@/lib/twilio")
          await envoyerSMS(
            destTel,
            `Bonjour ${facture.patient.prenom}, votre facture ${facture.numero} de ${Number(facture.total).toFixed(2)}$ chez ${facture.organisation.nom} est disponible. Pour payer ou obtenir une copie: ${facture.organisation.telephone ?? "contactez-nous"}.`
          )
          sent = true
        } catch (e) {
          errors.push(`SMS: ${String(e)}`)
        }
      }

      if (sent) {
        await ctx.db.facture.update({
          where: { id: input.id },
          data: { statut: "ENVOYE", envoyeLe: new Date() },
        })
      }

      return { ok: errors.length === 0, errors }
    }),

  marquerPaye: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const existing = await ctx.db.facture.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.facture.update({ where: { id: input.id }, data: { statut: "PAYE", payeLe: new Date() } })
    }),

  supprimer: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id: orgId } = await getOrgId(ctx)
      const existing = await ctx.db.facture.findFirst({ where: { id: input.id, orgId } })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.facture.delete({ where: { id: input.id } })
    }),
})
