import "server-only"

// Simple sliding window rate limiter — in-memory.
// For multi-instance prod, replace with @upstash/ratelimit + Redis.

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Clean up expired entries every 5 minutes to avoid unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, win] of store.entries()) {
      if (now > win.resetAt) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * @param key      Unique identifier (e.g. IP address or token)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  existing.count++
  const remaining = Math.max(0, limit - existing.count)
  return {
    success: existing.count <= limit,
    remaining,
    resetAt: existing.resetAt,
  }
}

// Pre-configured limiters for common use cases
export function rateLimitPublicForm(ip: string) {
  return rateLimit(`form:${ip}`, 30, 60_000) // 30 req/min per IP
}

export function rateLimitWebhook(ip: string) {
  return rateLimit(`webhook:${ip}`, 60, 60_000) // 60 req/min
}

export function rateLimitTRPC(userId: string, procedure: string) {
  return rateLimit(`trpc:${userId}:${procedure}`, 100, 60_000) // 100 calls/min per user per procedure
}
