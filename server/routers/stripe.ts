import { z } from "zod/v3"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, createTRPCRouter } from "@/server/trpc"
import { stripe } from "@/lib/stripe"

const PRICE_IDS: Record<string, string | undefined> = {
  DEMARRAGE: process.env.STRIPE_PRICE_DEMARRAGE_MONTHLY,
  CROISSANCE: process.env.STRIPE_PRICE_CROISSANCE_MONTHLY,
  CLINIQUE_PRO: process.env.STRIPE_PRICE_PRO_MONTHLY,
}

async function getOrg(ctx: { db: import("@prisma/client").PrismaClient; orgId: string }) {
  const org = await ctx.db.organisation.findUnique({ where: { clerkOrgId: ctx.orgId } })
  if (!org) throw new TRPCError({ code: "NOT_FOUND" })
  return org
}

export const stripeRouter = createTRPCRouter({
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const org = await getOrg(ctx)

    if (!org.stripeSubscriptionId) {
      return { forfait: org.forfait, forfaitActifDepuis: org.forfaitActifDepuis, forfaitExpireA: org.forfaitExpireA, subscription: null }
    }

    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
    return {
      forfait: org.forfait,
      forfaitActifDepuis: org.forfaitActifDepuis,
      forfaitExpireA: org.forfaitExpireA,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end,
      },
    }
  }),

  createCheckoutSession: protectedProcedure
    .input(z.object({
      forfait: z.enum(["DEMARRAGE", "CROISSANCE", "CLINIQUE_PRO"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const org = await getOrg(ctx)
      const priceId = PRICE_IDS[input.forfait]
      if (!priceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Forfait introuvable" })

      let customerId = org.stripeCustomerId ?? undefined
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: org.courriel ?? undefined,
          name: org.nom,
          metadata: { clerkOrgId: ctx.orgId },
        })
        customerId = customer.id
        await ctx.db.organisation.update({
          where: { id: org.id },
          data: { stripeCustomerId: customer.id },
        })
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { clerkOrgId: ctx.orgId, forfait: input.forfait },
        subscription_data: { metadata: { clerkOrgId: ctx.orgId, forfait: input.forfait } },
      })

      return { url: session.url! }
    }),

  createPortalSession: protectedProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const org = await getOrg(ctx)
      if (!org.stripeCustomerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Aucun abonnement actif" })

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: input.returnUrl,
      })

      return { url: session.url }
    }),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const org = await getOrg(ctx)
    if (!org.stripeCustomerId) return []

    const invoices = await stripe.invoices.list({
      customer: org.stripeCustomerId,
      limit: 12,
    })

    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: (inv.amount_paid ?? inv.amount_due) / 100,
      currency: inv.currency.toUpperCase(),
      date: new Date(inv.created * 1000),
      pdfUrl: inv.invoice_pdf,
    }))
  }),
})
