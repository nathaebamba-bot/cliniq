import type { Metadata } from "next"
import { Sora, DM_Sans, JetBrains_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { TRPCProvider } from "@/trpc/provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
})

export const metadata: Metadata = {
  title: { default: "Cliniq", template: "%s — Cliniq" },
  description: "Automatisation de la relation patient pour cliniques privées au Québec.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang={locale} className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
        <body className="font-sans antialiased bg-bg-primary text-text-primary">
          <NextIntlClientProvider messages={messages}>
            <TRPCProvider>
              {children}
              <Toaster position="bottom-right" richColors />
            </TRPCProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
