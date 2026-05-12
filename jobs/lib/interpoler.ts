import { format } from "date-fns"
import { fr, enCA } from "date-fns/locale"
import type { Patient, Praticien, Organisation } from "@prisma/client"

export function buildVariables(
  patient: Pick<Patient, "prenom" | "nom" | "langue">,
  rdvDate: Date,
  praticien: Pick<Praticien, "prenom" | "nom" | "titre">,
  clinique: Pick<Organisation, "nom">,
  extras?: Record<string, string>
): Record<string, string> {
  const langue = patient.langue === "EN" ? "EN" : "FR"
  const locale = langue === "FR" ? fr : enCA
  return {
    prenom: patient.prenom,
    nom: patient.nom,
    date: format(rdvDate, "EEEE d MMMM", { locale }),
    heure: format(rdvDate, "HH:mm"),
    praticien: `${praticien.titre ? praticien.titre + " " : ""}${praticien.prenom} ${praticien.nom}`,
    clinique: clinique.nom,
    ...extras,
  }
}

export function interpoler(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}
