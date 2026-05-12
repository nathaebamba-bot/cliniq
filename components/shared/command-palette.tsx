"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Search, User, Calendar, Phone, ArrowRight } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { trpc } from "@/trpc/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { StatutBadge } from "@/components/patients/statut-badge"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()

  const { data, isFetching } = trpc.search.global.useQuery(
    { q: query },
    { enabled: open && query.length >= 2, staleTime: 5000 }
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
      setQuery("")
    },
    [router]
  )

  const hasResults = (data?.patients.length ?? 0) + (data?.rdvs.length ?? 0) > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <DialogContent className="p-0 max-w-xl overflow-hidden gap-0">
        <Command shouldFilter={false} className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-text-tertiary shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Nom, téléphone, courriel…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-text-tertiary text-text-primary"
              autoFocus
            />
            {isFetching && (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin shrink-0" />
            )}
            <kbd className="text-xs text-text-tertiary bg-bg-secondary border border-border rounded px-1.5 py-0.5 font-mono shrink-0">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto">
            {query.length < 2 && (
              <div className="py-10 text-center">
                <p className="text-sm text-text-tertiary">Tapez au moins 2 caractères</p>
                <p className="text-xs text-text-tertiary mt-1 opacity-70">Ctrl+K pour ouvrir / fermer</p>
              </div>
            )}

            {query.length >= 2 && !isFetching && !hasResults && (
              <Command.Empty className="py-10 text-center text-sm text-text-tertiary">
                Aucun résultat pour « {query} »
              </Command.Empty>
            )}

            {/* Patients */}
            {(data?.patients.length ?? 0) > 0 && (
              <Command.Group
                heading="Patients"
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
              >
                {data!.patients.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={p.id}
                    onSelect={() => navigate(`/patients/${p.id}`)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer aria-selected:bg-bg-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-brand-primary">
                      {p.prenom[0]}{p.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {p.prenom} {p.nom}
                        {!p.actif && (
                          <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                            Inactif
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-text-tertiary flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {p.telephone}
                        {p.courriel && <span className="ml-1 truncate">· {p.courriel}</span>}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* RDVs */}
            {(data?.rdvs.length ?? 0) > 0 && (
              <Command.Group
                heading="Rendez-vous à venir"
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
              >
                {data!.rdvs.map((rdv) => (
                  <Command.Item
                    key={rdv.id}
                    value={`rdv-${rdv.id}`}
                    onSelect={() => navigate(`/patients/${rdv.patient.id}`)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer aria-selected:bg-bg-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">
                          {rdv.patient.prenom} {rdv.patient.nom}
                        </p>
                        <StatutBadge statut={rdv.statut} />
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {format(new Date(rdv.dateHeure), "EEEE d MMM 'à' HH:mm", { locale: fr })}
                        {" · "}{rdv.praticien.prenom} {rdv.praticien.nom}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-xs text-text-tertiary bg-bg-secondary">
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-primary border border-border rounded px-1 py-0.5 font-mono text-xs">↑↓</kbd> naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-primary border border-border rounded px-1 py-0.5 font-mono text-xs">↵</kbd> ouvrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-primary border border-border rounded px-1 py-0.5 font-mono text-xs">Esc</kbd> fermer
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
