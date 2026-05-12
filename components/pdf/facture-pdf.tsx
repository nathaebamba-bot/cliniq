import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#0F172A" },
  headerBand: { backgroundColor: "#2563EB", borderRadius: 8, padding: "16 20", marginBottom: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cliniqueName: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },
  cliniqueInfo: { fontSize: 8, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  factureLabel: { fontSize: 12, fontWeight: "bold", color: "#BFDBFE" },
  factureNumero: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },
  factureDate: { fontSize: 8, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  infoBox: { backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "10 14" },
  infoName: { fontSize: 12, fontWeight: "bold", color: "#0F172A", marginBottom: 3 },
  infoLine: { fontSize: 9, color: "#475569", marginBottom: 2 },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 20 },
  col: { flex: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: "7 10", borderRadius: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", padding: "7 10", borderBottom: "1px solid #F1F5F9" },
  tableRowAlt: { flexDirection: "row", padding: "7 10", backgroundColor: "#FAFAFA", borderBottom: "1px solid #F1F5F9" },
  th: { fontSize: 8, fontWeight: "bold", color: "#64748B" },
  td: { fontSize: 9, color: "#0F172A" },
  descCol: { flex: 1 },
  montantCol: { width: 80, textAlign: "right" },
  divider: { borderBottom: "1px solid #E2E8F0", marginVertical: 8 },
  totalsSection: { marginTop: 8, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 3 },
  totalLabel: { fontSize: 9, color: "#64748B", width: 100, textAlign: "right", marginRight: 12 },
  totalValue: { fontSize: 9, color: "#0F172A", width: 80, textAlign: "right" },
  grandTotalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4, backgroundColor: "#EFF6FF", padding: "8 12", borderRadius: 6 },
  grandTotalLabel: { fontSize: 11, fontWeight: "bold", color: "#1E40AF", width: 100, textAlign: "right", marginRight: 12 },
  grandTotalValue: { fontSize: 14, fontWeight: "bold", color: "#1E40AF", width: 80, textAlign: "right" },
  badge: { padding: "3 8", borderRadius: 12, alignSelf: "flex-start" },
  badgeText: { fontSize: 8, fontWeight: "bold" },
  notes: { backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "10 14", marginTop: 16 },
  notesTitle: { fontSize: 8, fontWeight: "bold", color: "#92400E", marginBottom: 4 },
  notesText: { fontSize: 9, color: "#78350F" },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#94A3B8", borderTop: "1px solid #E2E8F0", paddingTop: 8 },
})

const statutColors: Record<string, { bg: string; text: string }> = {
  BROUILLON: { bg: "#F1F5F9", text: "#475569" },
  ENVOYE: { bg: "#EFF6FF", text: "#1D4ED8" },
  PAYE: { bg: "#ECFDF5", text: "#065F46" },
  ANNULE: { bg: "#FEF2F2", text: "#991B1B" },
}

export interface FacturePDFData {
  numero: string
  createdAt: Date
  statut: string
  lignes: Array<{ description: string; montant: number }>
  sousTotal: number
  taxes: number
  total: number
  notes?: string | null
  patient: { prenom: string; nom: string; courriel?: string | null; telephone?: string | null }
  destNom?: string | null
  destCourriel?: string | null
  organisation: { nom: string; adresse?: string | null; ville?: string | null; telephone?: string | null; couleurPrimaire?: string | null }
  rendezvous?: { dateHeure: Date; typeRdv?: string | null; praticien?: { prenom: string; nom: string } | null } | null
}

export function FacturePDF({ data }: { data: FacturePDFData }) {
  const today = format(new Date(), "d MMMM yyyy", { locale: fr })
  const dateFacture = format(new Date(data.createdAt), "d MMMM yyyy", { locale: fr })
  const colors = statutColors[data.statut] ?? statutColors.BROUILLON
  const destinataireNom = data.destNom ?? `${data.patient.prenom} ${data.patient.nom}`
  const destinataireCourriel = data.destCourriel ?? data.patient.courriel
  const primaryColor = data.organisation.couleurPrimaire ?? "#2563EB"

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.headerBand, { backgroundColor: primaryColor }]}>
          <View>
            <Text style={s.cliniqueName}>{data.organisation.nom}</Text>
            {data.organisation.adresse && (
              <Text style={s.cliniqueInfo}>{data.organisation.adresse}{data.organisation.ville ? `, ${data.organisation.ville}` : ""}</Text>
            )}
            {data.organisation.telephone && (
              <Text style={s.cliniqueInfo}>{data.organisation.telephone}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.factureLabel}>FACTURE</Text>
            <Text style={s.factureNumero}>{data.numero}</Text>
            <Text style={s.factureDate}>Émise le {dateFacture}</Text>
            <View style={[s.badge, { backgroundColor: colors.bg, marginTop: 6 }]}>
              <Text style={[s.badgeText, { color: colors.text }]}>{data.statut}</Text>
            </View>
          </View>
        </View>

        {/* Patient + RDV info */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Facturé à</Text>
            <View style={s.infoBox}>
              <Text style={s.infoName}>{destinataireNom}</Text>
              {destinataireCourriel && <Text style={s.infoLine}>{destinataireCourriel}</Text>}
              {data.patient.telephone && <Text style={s.infoLine}>{data.patient.telephone}</Text>}
            </View>
          </View>
          {data.rendezvous && (
            <View style={s.col}>
              <Text style={s.sectionTitle}>Rendez-vous</Text>
              <View style={s.infoBox}>
                <Text style={s.infoName}>
                  {format(new Date(data.rendezvous.dateHeure), "EEEE d MMMM yyyy", { locale: fr })}
                </Text>
                <Text style={s.infoLine}>
                  {format(new Date(data.rendezvous.dateHeure), "HH:mm")}
                  {data.rendezvous.typeRdv ? ` — ${data.rendezvous.typeRdv}` : ""}
                </Text>
                {data.rendezvous.praticien && (
                  <Text style={s.infoLine}>
                    {data.rendezvous.praticien.prenom} {data.rendezvous.praticien.nom}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Line items */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Services</Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.descCol]}>Description</Text>
            <Text style={[s.th, s.montantCol]}>Montant</Text>
          </View>
          {data.lignes.map((ligne, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.td, s.descCol]}>{ligne.description}</Text>
              <Text style={[s.td, s.montantCol]}>{ligne.montant.toFixed(2)} $</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Sous-total</Text>
            <Text style={s.totalValue}>{data.sousTotal.toFixed(2)} $</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Taxes</Text>
            <Text style={s.totalValue}>{data.taxes.toFixed(2)} $</Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>Total</Text>
            <Text style={s.grandTotalValue}>{data.total.toFixed(2)} $</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={s.notes}>
            <Text style={s.notesTitle}>Notes</Text>
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        )}

        <View style={s.footer}>
          <Text>Généré par Cliniq · {data.organisation.nom}</Text>
          <Text>{today}</Text>
        </View>
      </Page>
    </Document>
  )
}
