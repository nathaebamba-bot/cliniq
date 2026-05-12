import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#0F172A" },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#475569", marginBottom: 2 },
  divider: { borderBottom: "2px solid #2563EB", marginBottom: 20 },
  question: { marginBottom: 14 },
  questionText: { fontSize: 10, fontWeight: "bold", marginBottom: 4, color: "#1E40AF" },
  answer: {
    fontSize: 10,
    padding: "6 10",
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
    border: "1px solid #E2E8F0",
    minHeight: 20,
  },
  noAnswer: { fontSize: 10, color: "#94A3B8", fontStyle: "italic" },
  alertBox: {
    padding: "8 12",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 6,
    marginBottom: 16,
  },
  alertText: { fontSize: 9, color: "#DC2626", fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94A3B8",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 8,
  },
})

interface Question {
  id: string
  type: string
  question: string
  obligatoire?: boolean
  options?: string[]
}

interface FormulairePDFProps {
  nomClinique: string
  nomPatient: string
  nomFormulaire: string
  completeLe: Date | null
  questions: Question[]
  reponses: Record<string, unknown>
}

function formatReponse(value: unknown, question: Question): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

function hasAlert(questions: Question[], reponses: Record<string, unknown>): boolean {
  return questions.some((q) => {
    const rep = reponses[q.id]
    const isAllergyQ = q.question.toLowerCase().includes("allergi")
    return isAllergyQ && rep && rep !== "Non" && rep !== false
  })
}

export function FormulairePDF({
  nomClinique,
  nomPatient,
  nomFormulaire,
  completeLe,
  questions,
  reponses,
}: FormulairePDFProps) {
  const showAlert = hasAlert(questions, reponses)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{nomFormulaire}</Text>
          <Text style={s.meta}>Patient : {nomPatient}</Text>
          <Text style={s.meta}>Clinique : {nomClinique}</Text>
          {completeLe && (
            <Text style={s.meta}>
              Complété le : {format(new Date(completeLe), "d MMMM yyyy à HH:mm", { locale: fr })}
            </Text>
          )}
        </View>

        <View style={s.divider} />

        {showAlert && (
          <View style={s.alertBox}>
            <Text style={s.alertText}>⚠ ALERTE — Allergie détectée. Vérifier avant les soins.</Text>
          </View>
        )}

        {questions.map((q) => {
          const rep = reponses[q.id]
          const texte = formatReponse(rep, q)
          return (
            <View key={q.id} style={s.question}>
              <Text style={s.questionText}>
                {q.question}{q.obligatoire ? " *" : ""}
              </Text>
              {texte ? (
                <Text style={s.answer}>{texte}</Text>
              ) : (
                <Text style={s.noAnswer}>Sans réponse</Text>
              )}
            </View>
          )
        })}

        <View style={s.footer}>
          <Text>Généré par Cliniq · {nomClinique}</Text>
          <Text>{format(new Date(), "d MMMM yyyy", { locale: fr })}</Text>
        </View>
      </Page>
    </Document>
  )
}
