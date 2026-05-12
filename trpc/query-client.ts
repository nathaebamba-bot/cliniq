import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query"
import superjson from "superjson"

function makeQueryClientFn() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: { deserializeData: superjson.deserialize },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function makeQueryClient() {
  if (isServer) return makeQueryClientFn()
  if (!browserQueryClient) browserQueryClient = makeQueryClientFn()
  return browserQueryClient
}
