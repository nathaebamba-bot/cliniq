import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe, construireEvenementStripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { resend, FROM } from "@/lib/resend"
import { FORFAIT_LABELS } from "@/lib/forfait"
import { render } from "@react-email/render"
import EmailBienvenue from "@/emails/bienvenue"
import EmailPaiementEchec from "@/emails/paiement-echec"
import EmailAbonnementAnnule from "@/emails/abonnement-annule"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

export const runtime = "nodejs"

type SubLike = { current_period_end: number; cancel_at_period_end: boolean; metadata?: Record<string, string> }
type InvoiceLike = { customer: string | { id: string } | null; subscription: string | { id: string } | null; amount_due?: number; amount_paid?: number; currency?: string }

function subPeriodEnd(sub: Stripe.Subscription): Date {
  return new Date((sub as unknown as SubLike).current_period_end * 1000)
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await construireEvenementStripe(body)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const clerkOrgId = session.metadata?.clerkOrgId
        const forfait = session.metadata?.forfait as "DEMARRAGE" | "CROISSANCE" | "CLINIQUE_PRO" | undefined
        if (!clerkOrgId || !forfait) break

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null

        const customerId = typeof session.customer === "string"
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id ?? null

        await db.organisation.update({
          where: { clerkOrgId },
          data: {
            forfait,
            forfaitActifDepuis: new Date(),
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId ?? undefined,
          },
        })

        const org = await db.organisation.findUnique({
          where: { clerkOrgId },
          select: { nom: true, courriel: true },
        })
        if (org?.courriel) {
          const html = await render(EmailBienvenue({
            nomClinique: org.nom,
            nomUtilisateur: org.nom,
            forfait: FORFAIT_LABELS[forfait],
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://cliniq.app",
          }))
          await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: org.courriel,
            subject: "Bienvenue sur Cliniq — votre compte est activé",
            html,
          })
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as InvoiceLike
        const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as { id: string } | null)?.id
        if (!customerId) break

        const subId = typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as { id: string } | null)?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await db.organisation.updateMany({
            where: { stripeCustomerId: customerId },
            data: { forfaitExpireA: subPeriodEnd(sub) },
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as InvoiceLike
        const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as { id: string } | null)?.id
        if (!customerId) break

        const org = await db.organisation.findFirst({
          where: { stripeCustomerId: customerId },
          select: { nom: true, courriel: true },
        })
        if (org?.courriel) {
          const montant = `${(((invoice.amount_due ?? 0) as number) / 100).toFixed(2)} ${((invoice.currency ?? "cad") as string).toUpperCase()}`
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/parametres`,
          })
          const html = await render(EmailPaiementEchec({
            nomClinique: org.nom,
            nomUtilisateur: org.nom,
            montant,
            portailUrl: portalSession.url,
          }))
          await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: org.courriel,
            subject: `Action requise — paiement échoué pour ${org.nom}`,
            html,
          })
        }
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer | null)?.id
        if (!customerId) break

        const forfaitMeta = (sub as unknown as SubLike).metadata?.forfait as "DEMARRAGE" | "CROISSANCE" | "CLINIQUE_PRO" | undefined
        await db.organisation.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            ...(forfaitMeta ? { forfait: forfaitMeta } : {}),
            forfaitExpireA: subPeriodEnd(sub),
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer | null)?.id
        if (!customerId) break

        const expireA = subPeriodEnd(sub)
        await db.organisation.updateMany({
          where: { stripeCustomerId: customerId },
          data: { forfaitExpireA: expireA },
        })

        const org = await db.organisation.findFirst({
          where: { stripeCustomerId: customerId },
          select: { nom: true, courriel: true },
        })
        if (org?.courriel) {
          const html = await render(EmailAbonnementAnnule({
            nomClinique: org.nom,
            nomUtilisateur: org.nom,
            dateExpiration: format(expireA, "d MMMM yyyy", { locale: fr }),
          }))
          await resend.emails.send({
            from: `${FROM.name} <${FROM.email}>`,
            to: org.courriel,
            subject: `Abonnement annulé — ${org.nom}`,
            html,
          })
        }
        break
      }
    }
  } catch (err) {
    console.error("Stripe webhook error:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
