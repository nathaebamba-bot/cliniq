import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Preview, Font,
} from "@react-email/components"

interface RappelRdvEmailProps {
  prenom: string
  date: string
  heure: string
  praticien: string
  clinique: string
  couleur?: string
  telephone?: string | null
  langue?: "FR" | "EN"
}

export function RappelRdvEmail({
  prenom,
  date,
  heure,
  praticien,
  clinique,
  couleur = "#2563EB",
  telephone,
  langue = "FR",
}: RappelRdvEmailProps) {
  const fr = langue !== "EN"

  return (
    <Html lang={fr ? "fr" : "en"}>
      <Head>
        <Font fontFamily="DM Sans" fallbackFontFamily="Arial" webFont={{ url: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2", format: "woff2" }} fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>{fr ? `Rappel de votre rendez-vous — ${date} à ${heure}` : `Appointment reminder — ${date} at ${heure}`}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>

          {/* Header */}
          <Section style={{ backgroundColor: couleur, borderRadius: "12px 12px 0 0", padding: "24px 32px" }}>
            <Text style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: "600", margin: 0 }}>
              {clinique}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ backgroundColor: "#FFFFFF", padding: "32px", borderRadius: "0 0 12px 12px", border: "1px solid #E2E8F0", borderTop: "none" }}>
            <Text style={{ fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 8px 0" }}>
              {fr ? `Bonjour ${prenom} 👋` : `Hello ${prenom} 👋`}
            </Text>
            <Text style={{ color: "#475569", fontSize: "16px", margin: "0 0 24px 0" }}>
              {fr
                ? "Voici un rappel pour votre prochain rendez-vous :"
                : "Here is a reminder for your upcoming appointment:"}
            </Text>

            {/* RDV card */}
            <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", padding: "20px 24px", marginBottom: "24px", borderLeft: `4px solid ${couleur}` }}>
              <Text style={{ margin: "0 0 6px 0", color: "#94A3B8", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {fr ? "Rendez-vous" : "Appointment"}
              </Text>
              <Text style={{ margin: "0 0 4px 0", color: "#0F172A", fontSize: "18px", fontWeight: "700" }}>
                {date}
              </Text>
              <Text style={{ margin: "0 0 8px 0", color: "#475569", fontSize: "15px" }}>
                {fr ? `à ${heure}` : `at ${heure}`} · {praticien}
              </Text>
            </Section>

            <Text style={{ color: "#475569", fontSize: "14px", margin: "0 0 24px 0" }}>
              {fr
                ? "Répondez « 1 » à notre SMS pour confirmer ou « 2 » pour annuler."
                : "Reply « 1 » to our SMS to confirm or « 2 » to cancel."}
            </Text>

            <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />

            <Text style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>
              {fr ? "Questions ? Contactez-nous" : "Questions? Contact us"}
              {telephone ? ` : ${telephone}` : "."}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default RappelRdvEmail