import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"
import { fr, enCA } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function interpolerMessage(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

export function formaterDate(date: Date, langue: "FR" | "EN" = "FR"): string {
  return format(date, "d MMMM yyyy", { locale: langue === "FR" ? fr : enCA })
}

export function formaterHeure(date: Date): string {
  return format(date, "HH:mm")
}

export function formaterDateRelative(date: Date, langue: "FR" | "EN" = "FR"): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: langue === "FR" ? fr : enCA })
}

export function estDansPlageHoraire(heureDebut: string, heureFin: string, fuseauHoraire: string): boolean {
  const maintenant = new Date()
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: fuseauHoraire,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
  const heureLocale = maintenant.toLocaleTimeString("fr-CA", opts)
  return heureLocale >= heureDebut && heureLocale <= heureFin
}

export function parserReponseSMS(reponse: string): "CONFIRMER" | "ANNULER" | "INCONNUE" {
  const r = reponse.trim().toLowerCase()
  if (["1", "oui", "yes", "o", "ok", "y"].includes(r)) return "CONFIRMER"
  if (["2", "non", "no", "n"].includes(r)) return "ANNULER"
  return "INCONNUE"
}

export function calculerRevenusRecuperes(noShowsEvites: number, tarifMoyen: number): number {
  return noShowsEvites * tarifMoyen
}
