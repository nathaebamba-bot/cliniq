"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  delta?: number
  deltaLabel?: string
  isLoading?: boolean
  invertDelta?: boolean
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  delta,
  deltaLabel,
  isLoading,
  invertDelta = false,
}: KpiCardProps) {
  const hasDelta = delta !== undefined && delta !== null
  const isPositive = invertDelta ? delta! < 0 : delta! > 0
  const isNeutral = delta === 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-display font-semibold text-text-primary">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {hasDelta && !isNeutral && (
                <>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-brand-accent" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-brand-danger" />
                  )}
                  <span className={`text-xs font-medium ${isPositive ? "text-brand-accent" : "text-brand-danger"}`}>
                    {delta! > 0 ? "+" : ""}{delta}
                  </span>
                </>
              )}
              {hasDelta && isNeutral && <Minus className="h-3 w-3 text-text-tertiary" />}
              {subtitle && (
                <span className="text-xs text-text-tertiary">{subtitle}</span>
              )}
              {deltaLabel && (
                <span className="text-xs text-text-tertiary">{deltaLabel}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
