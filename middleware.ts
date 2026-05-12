import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/f/(.*)",                          // Public form pages
  "/api/webhooks/(.*)",               // Webhooks (validated by their own signature)
  "/api/trpc/(.*)",                   // tRPC — individual procedures enforce auth
  "/politique-de-confidentialite(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
