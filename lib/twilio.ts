import "server-only"
import twilio from "twilio"

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function envoyerSMS(to: string, body: string): Promise<string> {
  const message = await getClient().messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  })
  return message.sid
}

export function validerSignatureTwilio(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN!, signature, url, params)
}
