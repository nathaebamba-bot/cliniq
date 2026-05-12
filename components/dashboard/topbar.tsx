"use client"

import { UserButton, OrganizationSwitcher } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"

function toggleLocale() {
  const current = document.cookie.match(/cliniq-locale=([^;]+)/)?.[1] ?? "fr"
  const next = current === "fr" ? "en" : "fr"
  document.cookie = `cliniq-locale=${next}; path=/; max-age=31536000`
  window.location.reload()
}

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-bg-primary px-6">
      <h1 className="font-display text-lg font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          appearance={{ elements: { rootBox: "text-sm" } }}
        />
        <Button variant="ghost" size="icon" onClick={toggleLocale} title="Changer de langue / Switch language">
          <Languages className="h-4 w-4" />
        </Button>
        <UserButton />
      </div>
    </header>
  )
}
