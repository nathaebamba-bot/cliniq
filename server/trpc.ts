import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import superjson from "superjson"
import { ZodError } from "zod/v3"
import { db } from "@/lib/prisma"

export async function createTRPCContext() {
  const { userId, orgId, orgRole } = await auth()
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  return { userId, orgId, orgRole, db, ip }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createCallerFactory = t.createCallerFactory
export const createTRPCRouter = t.router

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, orgId: ctx.orgId } })
})

const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  if (ctx.orgRole !== "org:admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux administrateurs." })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, orgId: ctx.orgId } })
})

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(enforceAuth)
export const adminProcedure = t.procedure.use(enforceAdmin)
