import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/prisma"
import { Sidebar } from "@/components/dashboard/sidebar"
import { PaymentFailedBanner } from "@/components/dashboard/payment-failed-banner"
import { AiAssistant } from "@/components/shared/ai-assistant"

async function ensureOrganisation(clerkOrgId: string) {
  const existing = await db.organisation.findUnique({ where: { clerkOrgId } })
  if (existing) return

  // Fetch org name from Clerk
  const client = await clerkClient()
  const clerkOrg = await client.organizations.getOrganization({ organizationId: clerkOrgId })

  await db.organisation.create({
    data: {
      clerkOrgId,
      nom: clerkOrg.name,
      type: "AUTRE",
      parametres: { create: {} },
    },
  })
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth()

  if (!userId) redirect("/sign-in")
  if (!orgId) redirect("/onboarding")

  await ensureOrganisation(orgId)

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PaymentFailedBanner />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <AiAssistant />
    </div>
  )
}
