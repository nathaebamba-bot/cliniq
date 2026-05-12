export type TypeQuestion =
  | "text-court"
  | "text-long"
  | "oui-non"
  | "choix-multiple"
  | "cases-cocher"
  | "echelle"
  | "date"
  | "section"

export interface Question {
  id: string
  type: TypeQuestion
  question: string
  obligatoire: boolean
  options?: string[]      // for choix-multiple and cases-cocher
  min?: number            // for echelle (default 0)
  max?: number            // for echelle (default 10)
  description?: string    // for section header subtitle
  condition?: {           // show question only if another answered a certain way
    questionId: string
    reponse: string
  }
}

export interface ReponseMap {
  [questionId: string]: string | string[] | number | boolean | null
}

export const TYPE_LABELS: Record<TypeQuestion, string> = {
  "text-court":      "Texte court",
  "text-long":       "Texte long",
  "oui-non":         "Oui / Non",
  "choix-multiple":  "Choix unique",
  "cases-cocher":    "Cases à cocher",
  "echelle":         "Échelle (0–10)",
  "date":            "Date",
  "section":         "Titre de section",
}
