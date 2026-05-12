import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#0F172A" },
  header: { marginBottom: 28 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#475569" },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottom: "1px solid #E2E8F0",
    color: "#1E40AF",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiBox: {
    width: "22%",
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    border: "1px solid #E2E8F0",
  },
  kpiValue: { fontSize: 18, fontWeight: "bold", color: "#2563EB", marginBottom: 3 },
  kpiLabel: { fontSize: 8, color: "#475569" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: "6 10",
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 10",
    borderBottom: "1px solid #F1F5F9",
  },
  th: { fontSize: 8, fontWeight: "bold", color: "#475569", flex: 1 },
  td: { fontSize: 9, color: "#0F172A", flex: 1 },
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

export interface RapportData {
  nomClinique: string
  annee: number
  mois: number
  totalRdv: number
  noShows: number
  tauxNoShow: number
  noShowsEvites: number
  confirmes: number
  tauxConfirmation: number
  avisEnvoyes: number
  formulairesComplete: number
  relancesEnvoyees: number
  revenusRecuperes: number
  parSemaine: Array<{ semaine: string; total: number; noShows: number }>
}

export function RapportPDF({ data }: { data: RapportData }) {
  const moisLabel = format(new Date(data.annee, data.mois - 1, 1), "MMMM yyyy", { locale: fr })
  const today = format(new Date(), "d MMMM yyyy", { locale: fr })

  const kpis = [
    { label: "Total RDV", value: String(data.totalRdv) },
    { label: `No-shows (${data.tauxNoShow}%)`, value: String(data.noShows) },
    { label: "Taux de confirmation", value: `${data.tauxConfirmation}%` },
    { label: "Revenus récupérés", value: `${data.revenusRecuperes} $` },
    { label: "Avis Google envoyés", value: String(data.avisEnvoyes) },
    { label: "Formulaires complétés", value: String(data.formulairesComplete) },
    { label: "Relances envoyées", value: String(data.relancesEnvoyees) },
    { label: "No-shows évités", value: String(data.noShowsEvites) },
  ]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{data.nomClinique}</Text>
          <Text style={s.subtitle}>Rapport mensuel — {moisLabel}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Indicateurs clés</Text>
          <View style={s.grid}>
            {kpis.map((k, i) => (
              <View key={i} style={s.kpiBox}>
                <Text style={s.kpiValue}>{k.value}</Text>
                <Text style={s.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {data.parSemaine.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>No-shows par semaine</Text>
            <View style={s.tableHeader}>
              <Text style={s.th}>Semaine du</Text>
              <Text style={s.th}>Total RDV</Text>
              <Text style={s.th}>No-shows</Text>
              <Text style={s.th}>Taux</Text>
            </View>
            {data.parSemaine.map((row, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.td}>
                  {format(new Date(row.semaine + "T12:00:00"), "d MMMM", { locale: fr })}
                </Text>
                <Text style={s.td}>{row.total}</Text>
                <Text style={s.td}>{row.noShows}</Text>
                <Text style={s.td}>
                  {row.total > 0 ? Math.round((row.noShows / row.total) * 100) : 0}%
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text>Généré par Cliniq</Text>
          <Text>{today}</Text>
        </View>
      </Page>
    </Document>
  )
}
