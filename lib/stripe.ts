import "server-only"
import Stripe from "stripe"
import { headers } from "next/headers"

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true })
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === "function" ? (value as Function).bind(instance) : value
  },
})

export async function construireEvenementStripe(body: string): Promise<Stripe.Event> {
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")!
  return getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
}
