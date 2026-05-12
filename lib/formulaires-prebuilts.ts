import type { Question } from "@/types/formulaire"

export interface FormulairePrebuilt {
  nom: string
  type: "DENTAIRE" | "PHYSIOTHERAPIE" | "MASSOTHERAPIE"
  questions: Question[]
}

export const FORMULAIRES_PREBUILTS: FormulairePrebuilt[] = [
  {
    nom: "Anamnèse dentaire générale",
    type: "DENTAIRE",
    questions: [
      { id: "q1",  type: "section",        question: "Motif de visite",            obligatoire: false },
      { id: "q2",  type: "text-long",      question: "Quel est le motif de votre visite aujourd'hui ?", obligatoire: true },
      { id: "q3",  type: "section",        question: "Santé générale",             obligatoire: false },
      { id: "q4",  type: "oui-non",        question: "Avez-vous des allergies connues ?", obligatoire: true },
      { id: "q5",  type: "text-court",     question: "Si oui, lesquelles ?",       obligatoire: false, condition: { questionId: "q4", reponse: "oui" } },
      { id: "q6",  type: "oui-non",        question: "Prenez-vous des médicaments actuellement ?", obligatoire: true },
      { id: "q7",  type: "text-court",     question: "Si oui, lesquels ?",         obligatoire: false, condition: { questionId: "q6", reponse: "oui" } },
      { id: "q8",  type: "cases-cocher",   question: "Avez-vous l'une de ces conditions médicales ?", obligatoire: false,
        options: ["Diabète", "Hypertension", "Problèmes cardiaques", "Anticoagulants", "Grossesse"] },
      { id: "q9",  type: "oui-non",        question: "Fumez-vous ou utilisez-vous des produits du tabac ?", obligatoire: false },
      { id: "q10", type: "section",        question: "Santé dentaire",             obligatoire: false },
      { id: "q11", type: "echelle",        question: "Comment évalueriez-vous votre anxiété dentaire ?", obligatoire: true, min: 0, max: 10 },
      { id: "q12", type: "date",           question: "Date approximative de votre dernière visite dentaire", obligatoire: false },
      { id: "q13", type: "oui-non",        question: "Ressentez-vous actuellement de la douleur ?", obligatoire: true },
      { id: "q14", type: "text-court",     question: "Si oui, où se situe-t-elle ?", obligatoire: false, condition: { questionId: "q13", reponse: "oui" } },
      { id: "q15", type: "section",        question: "Consentement",               obligatoire: false },
      { id: "q16", type: "oui-non",        question: "Je consens aux soins dentaires nécessaires proposés par mon praticien.", obligatoire: true },
    ],
  },
  {
    nom: "Bilan initial physiothérapie",
    type: "PHYSIOTHERAPIE",
    questions: [
      { id: "q1",  type: "section",       question: "Zone douloureuse",            obligatoire: false },
      { id: "q2",  type: "text-court",    question: "Quelle zone est douloureuse ou problématique ?", obligatoire: true },
      { id: "q3",  type: "date",          question: "Depuis quand avez-vous ce problème ?", obligatoire: false },
      { id: "q4",  type: "choix-multiple",question: "Comment ce problème a-t-il débuté ?", obligatoire: true,
        options: ["Accident / blessure soudaine", "Apparition graduelle", "Sans raison apparente", "Suite à une chirurgie"] },
      { id: "q5",  type: "section",       question: "Évaluation de la douleur",    obligatoire: false },
      { id: "q6",  type: "echelle",       question: "Niveau de douleur au repos (0 = aucune, 10 = insupportable)", obligatoire: true, min: 0, max: 10 },
      { id: "q7",  type: "echelle",       question: "Niveau de douleur en mouvement", obligatoire: true, min: 0, max: 10 },
      { id: "q8",  type: "text-long",     question: "Qu'est-ce qui aggrave la douleur ?", obligatoire: false },
      { id: "q9",  type: "section",       question: "Antécédents",                 obligatoire: false },
      { id: "q10", type: "oui-non",       question: "Avez-vous déjà reçu des traitements pour ce problème ?", obligatoire: false },
      { id: "q11", type: "text-court",    question: "Si oui, lesquels ?",          obligatoire: false, condition: { questionId: "q10", reponse: "oui" } },
      { id: "q12", type: "oui-non",       question: "Avez-vous des conditions médicales à signaler ?", obligatoire: false },
      { id: "q13", type: "text-court",    question: "Si oui, lesquelles ?",        obligatoire: false, condition: { questionId: "q12", reponse: "oui" } },
      { id: "q14", type: "oui-non",       question: "Prenez-vous des médicaments actuellement ?", obligatoire: false },
      { id: "q15", type: "text-court",    question: "Si oui, lesquels ?",          obligatoire: false, condition: { questionId: "q14", reponse: "oui" } },
      { id: "q16", type: "section",       question: "Objectif",                    obligatoire: false },
      { id: "q17", type: "text-long",     question: "Quel est votre principal objectif avec la physiothérapie ?", obligatoire: true },
    ],
  },
  {
    nom: "Évaluation initiale massothérapie",
    type: "MASSOTHERAPIE",
    questions: [
      { id: "q1",  type: "section",       question: "Zones à traiter",             obligatoire: false },
      { id: "q2",  type: "cases-cocher",  question: "Zones à traiter en priorité", obligatoire: true,
        options: ["Nuque / cou", "Épaules", "Dos", "Lombaires", "Bras / mains", "Jambes / pieds", "Abdomen", "Autre"] },
      { id: "q3",  type: "cases-cocher",  question: "Zones à éviter absolument",   obligatoire: false,
        options: ["Nuque / cou", "Épaules", "Dos", "Lombaires", "Bras / mains", "Jambes / pieds", "Abdomen"] },
      { id: "q4",  type: "section",       question: "Santé générale",              obligatoire: false },
      { id: "q5",  type: "oui-non",       question: "Avez-vous des conditions de santé à signaler (blessures récentes, grossesse, etc.) ?", obligatoire: true },
      { id: "q6",  type: "text-long",     question: "Si oui, précisez",            obligatoire: false, condition: { questionId: "q5", reponse: "oui" } },
      { id: "q7",  type: "section",       question: "Préférences",                 obligatoire: false },
      { id: "q8",  type: "choix-multiple",question: "Quelle pression préférez-vous ?", obligatoire: true,
        options: ["Légère", "Moyenne", "Ferme", "Peu importe"] },
      { id: "q9",  type: "oui-non",       question: "Avez-vous déjà reçu un massage thérapeutique ?", obligatoire: false },
      { id: "q10", type: "choix-multiple",question: "Quel est votre objectif principal ?", obligatoire: true,
        options: ["Relaxation", "Douleurs musculaires", "Stress / anxiété", "Blessure sportive", "Autre"] },
    ],
  },
]
