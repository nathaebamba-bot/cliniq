import type { Forfait } from "@prisma/client"

export const FORFAIT_LABELS: Record<Forfait, string> = {
  DEMARRAGE: "Démarrage",
  CROISSANCE: "Croissance",
  CLINIQUE_PRO: "Clinique Pro",
}

export const FORFAIT_PRIX: Record<Forfait, string> = {
  DEMARRAGE: "990 $/mois",
  CROISSANCE: "2 200 $/mois",
  CLINIQUE_PRO: "4 500 $/mois",
}

export const FORFAIT_LIMITES: Record<Forfait, { praticiens: number; sms: number }> = {
  DEMARRAGE: { praticiens: 1, sms: 500 },
  CROISSANCE: { praticiens: 5, sms: 2000 },
  CLINIQUE_PRO: { praticiens: Infinity, sms: Infinity },
}

export function peutAjouterPraticien(forfait: Forfait, praticienActuels: number): boolean {
  return praticienActuels < FORFAIT_LIMITES[forfait].praticiens
}
