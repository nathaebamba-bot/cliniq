"use client"

import { useState, useMemo } from "react"
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks,
  addMonths, subWeeks, subMonths, subDays, format, isSameDay, isSameMonth,
  eachDayOfInterval, getHours, getMinutes, isToday, parseISO,
} from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { NouveauRdvModal } from "./nouveau-rdv-modal"
import { RdvDrawer } from "./rdv-drawer"
import type { StatutRdv } from "@prisma/client"

type Vue = "jour" | "semaine" | "mois"

interface RdvItem {
  id: string
  dateHeure: Date
  dureeMinutes: number
  typeRdv: string | null
  notes: string | null
  statut: StatutRdv
  patient: { id: string; prenom: string; nom: string; telephone: string }
  praticien: { id: string; prenom: string; nom: string; couleur: string | null }
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h–19h

const STATUT_COLORS: Record<StatutRdv, string> = {
  PLANIFIE:   "#64748b",
  CONFIRME:   "#2563EB",
  ARRIVE:     "#4f46e5",
  COMPLETE:   "#10B981",
  NO_SHOW:    "#EF4444",
  ANNULE:     "#f97316",
  REPLANIFIE: "#eab308",
}

function RdvBlock({
  rdv,
  onClick,
}: {
  rdv: RdvItem
  onClick: (rdv: RdvItem) => void
}) {
  const color = rdv.praticien.couleur ?? STATUT_COLORS[rdv.statut]
  return (
    <button
      className="absolute left-0 right-1 rounded-md text-left text-xs px-1.5 py-0.5 overflow-hidden cursor-pointer hover:brightness-95 transition-all z-10 border border-white/20"
      style={{
        backgroundColor: color + "33",
        borderLeft: `3px solid ${color}`,
        top: `${((getHours(new Date(rdv.dateHeure)) - 7) * 60 + getMinutes(new Date(rdv.dateHeure))) * (48 / 60)}px`,
        height: `${rdv.dureeMinutes * (48 / 60)}px`,
      }}
      onClick={() => onClick(rdv)}
    >
      <p className="font-semibold truncate" style={{ color }}>
        {format(new Date(rdv.dateHeure), "HH:mm")} — {rdv.patient.prenom} {rdv.patient.nom}
      </p>
      {rdv.typeRdv && <p className="truncate text-text-secondary">{rdv.typeRdv}</p>}
    </button>
  )
}

export function CalendrierRdv() {
  const [vue, setVue] = useState<Vue>("semaine")
  const [date, setDate] = useState(new Date())
  const [selectedRdv, setSelectedRdv] = useState<RdvItem | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showNouveau, setShowNouveau] = useState(false)
  const [selectedPraticienId, setSelectedPraticienId] = useState<string>("")

  const { dateDebut, dateFin } = useMemo(() => {
    if (vue === "jour") return { dateDebut: date, dateFin: addDays(date, 1) }
    if (vue === "semaine")
      return {
        dateDebut: startOfWeek(date, { weekStartsOn: 1 }),
        dateFin: endOfWeek(date, { weekStartsOn: 1 }),
      }
    return { dateDebut: startOfMonth(date), dateFin: endOfMonth(date) }
  }, [vue, date])

  const { data: rdvData, isLoading } = trpc.rendezVous.liste.useQuery({
    dateDebut,
    dateFin,
    praticienId: selectedPraticienId || undefined,
  })

  const { data: org } = trpc.organisation.get.useQuery()
  const praticiens = org?.praticiens ?? []

  const rdvs: RdvItem[] = (rdvData ?? []).map((r) => ({
    ...r,
    dateHeure: new Date(r.dateHeure),
  }))

  const navigate = (dir: 1 | -1) => {
    if (vue === "jour") setDate((d) => (dir === 1 ? addDays(d, 1) : subDays(d, 1)))
    else if (vue === "semaine") setDate((d) => (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)))
    else setDate((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)))
  }

  const title = useMemo(() => {
    if (vue === "jour") return format(date, "EEEE d MMMM yyyy", { locale: fr })
    if (vue === "semaine") {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      const end = endOfWeek(date, { weekStartsOn: 1 })
      return `${format(start, "d MMM", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`
    }
    return format(date, "MMMM yyyy", { locale: fr })
  }, [vue, date])

  const handleRdvClick = (rdv: RdvItem) => {
    setSelectedRdv(rdv)
    setShowDrawer(true)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["jour", "semaine", "mois"] as Vue[]).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                vue === v
                  ? "bg-brand-primary text-white font-medium"
                  : "text-text-secondary hover:bg-bg-secondary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-medium px-3 hover:text-brand-primary transition-colors capitalize"
            onClick={() => setDate(new Date())}
          >
            {title}
          </button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
          Aujourd'hui
        </Button>

        {/* Praticien filter */}
        {praticiens.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                !selectedPraticienId
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "border-border text-text-secondary hover:bg-bg-secondary"
              }`}
              onClick={() => setSelectedPraticienId("")}
            >
              Tous
            </button>
            {praticiens.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedPraticienId === p.id
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "border-border text-text-secondary hover:bg-bg-secondary"
                }`}
                onClick={() => setSelectedPraticienId(p.id === selectedPraticienId ? "" : p.id)}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full mr-1"
                  style={{ backgroundColor: p.couleur ?? "#64748b" }}
                />
                {p.prenom} {p.nom}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto">
          <Button onClick={() => setShowNouveau(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau RDV
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-card" />
      ) : vue === "mois" ? (
        <VueMois date={date} rdvs={rdvs} onRdvClick={handleRdvClick} />
      ) : vue === "semaine" ? (
        <VueSemaine date={date} rdvs={rdvs} onRdvClick={handleRdvClick} />
      ) : (
        <VueJour date={date} rdvs={rdvs} onRdvClick={handleRdvClick} />
      )}

      <NouveauRdvModal
        open={showNouveau}
        onOpenChange={setShowNouveau}
        defaultDate={date}
      />

      <RdvDrawer
        rdv={selectedRdv}
        open={showDrawer}
        onOpenChange={setShowDrawer}
      />
    </>
  )
}

// ── Vue Semaine ────────────────────────────────────────────────────────────────

function VueSemaine({
  date,
  rdvs,
  onRdvClick,
}: {
  date: Date
  rdvs: RdvItem[]
  onRdvClick: (rdv: RdvItem) => void
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  })

  return (
    <div className="rounded-card border border-border overflow-auto">
      {/* Header */}
      <div className="grid border-b border-border bg-bg-secondary" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        <div className="h-12" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`h-12 flex flex-col items-center justify-center border-l border-border text-sm ${
              isToday(day) ? "text-brand-primary font-semibold" : "text-text-secondary"
            }`}
          >
            <span className="text-xs uppercase">{format(day, "EEE", { locale: fr })}</span>
            <span className={`text-lg font-semibold ${isToday(day) ? "bg-brand-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-base" : ""}`}>
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="grid overflow-auto max-h-[600px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        {/* Time gutter */}
        <div>
          {HOURS.map((h) => (
            <div key={h} className="h-12 flex items-start justify-end pr-2 pt-1 text-xs text-text-tertiary">
              {h}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dayRdvs = rdvs.filter((r) => isSameDay(new Date(r.dateHeure), day))
          return (
            <div
              key={day.toISOString()}
              className="relative border-l border-border"
              style={{ height: `${HOURS.length * 48}px` }}
            >
              {HOURS.map((h) => (
                <div key={h} className="h-12 border-t border-border/50" />
              ))}
              {dayRdvs.map((rdv) => (
                <RdvBlock key={rdv.id} rdv={rdv} onClick={onRdvClick} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vue Jour ──────────────────────────────────────────────────────────────────

function VueJour({
  date,
  rdvs,
  onRdvClick,
}: {
  date: Date
  rdvs: RdvItem[]
  onRdvClick: (rdv: RdvItem) => void
}) {
  const dayRdvs = rdvs.filter((r) => isSameDay(new Date(r.dateHeure), date))

  return (
    <div className="rounded-card border border-border overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: "56px 1fr" }}>
        <div />
        <div className="border-b border-border bg-bg-secondary h-12 flex items-center justify-center text-sm font-semibold text-brand-primary">
          {format(date, "EEEE d MMMM", { locale: fr })}
        </div>
        <div>
          {HOURS.map((h) => (
            <div key={h} className="h-12 flex items-start justify-end pr-2 pt-1 text-xs text-text-tertiary">
              {h}:00
            </div>
          ))}
        </div>
        <div
          className="relative border-l border-border"
          style={{ height: `${HOURS.length * 48}px` }}
        >
          {HOURS.map((h) => (
            <div key={h} className="h-12 border-t border-border/50" />
          ))}
          {dayRdvs.map((rdv) => (
            <RdvBlock key={rdv.id} rdv={rdv} onClick={onRdvClick} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function VueMois({
  date,
  rdvs,
  onRdvClick,
}: {
  date: Date
  rdvs: RdvItem[]
  onRdvClick: (rdv: RdvItem) => void
}) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  return (
    <div className="rounded-card border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-bg-secondary border-b border-border">
        {weekDays.map((d) => (
          <div key={d} className="h-10 flex items-center justify-center text-sm font-medium text-text-secondary">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayRdvs = rdvs.filter((r) => isSameDay(new Date(r.dateHeure), day))
          const inMonth = isSameMonth(day, date)
          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 p-1.5 border-t border-r border-border ${
                !inMonth ? "bg-bg-secondary/50" : ""
              }`}
            >
              <span
                className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-sm mb-1 ${
                  isToday(day)
                    ? "bg-brand-primary text-white font-semibold"
                    : inMonth
                    ? "text-text-primary font-medium"
                    : "text-text-tertiary"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayRdvs.slice(0, 3).map((rdv) => {
                  const color = rdv.praticien.couleur ?? STATUT_COLORS[rdv.statut]
                  return (
                    <button
                      key={rdv.id}
                      className="w-full text-left text-xs rounded px-1 py-0.5 truncate transition-opacity hover:opacity-80"
                      style={{ backgroundColor: color + "22", borderLeft: `2px solid ${color}`, color }}
                      onClick={() => onRdvClick(rdv)}
                    >
                      {format(new Date(rdv.dateHeure), "HH:mm")} {rdv.patient.nom}
                    </button>
                  )
                })}
                {dayRdvs.length > 3 && (
                  <p className="text-xs text-text-tertiary pl-1">+{dayRdvs.length - 3} autres</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
