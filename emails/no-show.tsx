import {
  Html, Head, Body, Container, Section, Text, Hr, Preview, Font,
} from "@react-email/components"

interface NoShowEmailProps {
  nomPatient: string
  date: string
  heure: string
  praticien: string
  clinique: string
  telephone?: string | null
  couleur?: string
}

export function NoShowEmail({
  nomPatient, date, heure, praticien, clinique, telephone, couleur = "#EF4444",
}: NoShowEmailProps) {
  return (
    <Html lang="fr">
      <Head>
        <Font fontFamily="DM Sans" fallbackFontFamily="Arial" webFont={{ url: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2", format: "woff2" }} fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>No-show enregistre - {nomPatient} - {date} a {heure}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: couleur, borderRadius: "12px 12px 0 0", padding: "24px 32px" }}>
            <Text style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: "600", margin: 0 }}>{clinique}</Text>
          </Section>
          <Section style={{ backgroundColor: "#FFFFFF", padding: "32px", borderRadius: "0 0 12px 12px", border: "1px solid #E2E8F0", borderTop: "none" }}>
            <Text style={{ fontSize: "22px", fontWeight: "700", color: "#0F172A", margin: "0 0 8px 0" }}>
              Absence enregistree
            </Text>
            <Text style={{ color: "#475569", fontSize: "15px", margin: "0 0 24px 0" }}>
              Le patient suivant ne s est pas presente a son rendez-vous :
            </Text>
            <Section style={{ backgroundColor: "#FEF2F2", borderRadius: "8px", padding: "20px 24px", marginBottom: "24px", borderLeft: "4px solid #EF4444" }}>
              <Text style={{ margin: "0 0 4px 0", color: "#0F172A", fontSize: "18px", fontWeight: "700" }}>{nomPatient}</Text>
              <Text style={{ margin: "0 0 4px 0", color: "#475569", fontSize: "15px" }}>{date} a {heure}</Text>
              <Text style={{ margin: 0, color: "#475569", fontSize: "14px" }}>avec {praticien}</Text>
            </Section>
            <Text style={{ color: "#475569", fontSize: "14px", margin: "0 0 24px 0" }}>
              Une relance automatique sera envoyee selon la configuration de vos automatisations.
            </Text>
            <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
            <Text style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>
              Cet email est envoye automatiquement par Cliniq.{telephone ? ` Contact : ${telephone}` : ""}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default NoShowEmail
