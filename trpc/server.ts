import "server-only"
import { createHydrationHelpers } from "@trpc/react-query/rsc"
import { cache } from "react"
import { createCallerFactory, createTRPCContext } from "@/server/trpc"
import { appRouter } from "@/server/root"
import { makeQueryClient } from "./query-client"

const createCaller = createCallerFactory(appRouter)

const createContext = cache(createTRPCContext)

export const { trpc: api, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  createCaller(createContext),
  () => makeQueryClient()
)
