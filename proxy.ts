import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/f/(.*)",
  "/politique-de-confidentialite(.*)",
  "/api/webhooks/(.*)",
  "/api/trpc/(.*)",
  "/api/cal/(.*)",
  "/api/avis/click/(.*)",
])

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)", "/patients(.*)", "/rendez-vous(.*)", "/automatisations(.*)", "/formulaires(.*)", "/avis(.*)", "/rapports(.*)", "/parametres(.*)"])

export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    if (!isPublicRoute(req)) {
      await auth.protect()
    }

    // Redirect authenticated users without an active org to onboarding
    const { userId, orgId } = await auth()
    if (userId && !orgId && isDashboardRoute(req)) {
      const url = req.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }

    const res = NextResponse.next()
    res.headers.set("X-Content-Type-Options", "nosniff")
    res.headers.set("X-Frame-Options", "DENY")
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return res
  },
  {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY,
  }
)

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
