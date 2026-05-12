"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Zap,
  FileText,
  Star,
  BarChart3,
  Settings,
  Globe,
  Search,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trpc } from "@/trpc/client"
import { CommandPalette } from "@/components/shared/command-palette"

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "patients", href: "/patients", icon: Users },
  { key: "rendezVous", href: "/rendez-vous", icon: CalendarDays },
  { key: "automatisations", href: "/automatisations", icon: Zap },
  { key: "formulaires", href: "/formulaires", icon: FileText },
  { key: "factures", href: "/factures", icon: Receipt },
  { key: "avis", href: "/avis", icon: Star },
  { key: "rapports", href: "/rapports", icon: BarChart3 },
  { key: "parametres", href: "/parametres", icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("nav")
  const locale = useLocale()

  const { data: nonConfirmes } = trpc.dashboard.nonConfirmesAujourdhui.useQuery(undefined, {
    refetchInterval: 30_000,
  })

  const toggleLocale = () => {
    const next = locale === "fr" ? "en" : "fr"
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <>
      <CommandPalette />
      <aside className="flex h-full w-60 flex-col border-r border-[var(--border)] bg-bg-secondary">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-[var(--border)]">
          <span className="font-display text-xl font-semibold text-brand-primary">Cliniq</span>
        </div>

        {/* Search trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
              document.dispatchEvent(ev)
            }}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-text-tertiary bg-bg-tertiary hover:bg-border transition-colors border border-border"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Rechercher…</span>
            <kbd className="text-xs font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">Ctrl K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <ul className="space-y-0.5">
            {navItems.map(({ key, href, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
              const showBadge = key === "rendezVous" && (nonConfirmes ?? 0) > 0
              return (
                <li key={key}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-primary text-white"
                        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t(key)}</span>
                    {showBadge && (
                      <span className={cn(
                        "text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums",
                        isActive ? "bg-white/20 text-white" : "bg-brand-warning/20 text-brand-warning"
                      )}>
                        {nonConfirmes}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Language toggle + footer */}
        <div className="border-t border-[var(--border)] p-4 space-y-2">
          <button
            onClick={toggleLocale}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            {locale === "fr" ? "Switch to English" : "Passer en français"}
          </button>
          <p className="text-xs text-text-tertiary text-center">Cliniq · © 2026</p>
        </div>
      </aside>
    </>
  )
}
