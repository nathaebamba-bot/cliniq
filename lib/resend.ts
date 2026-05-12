import "server-only"
import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const instance = getResend()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === "function" ? (value as Function).bind(instance) : value
  },
})

export const FROM = {
  get email() { return process.env.RESEND_FROM_EMAIL ?? "noreply@cliniq.app" },
  get name() { return process.env.RESEND_FROM_NAME ?? "Cliniq" },
}
