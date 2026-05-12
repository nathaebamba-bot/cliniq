import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Preview, Font,
} from "@react-email/components"

interface FormulaireEmailProps {
  prenom: string
  nomFormulaire: string
  lien: string
  clinique: string
  couleur?: string
  telephone?: string | null
  langue?: "FR" | "EN"
}

export function FormulaireEmail({
  prenom,
  nomFormulaire,
  lien,
  clinique,
  couleur = "#2563EB",
  telephone,
  langue = "FR",
}: FormulaireEmailProps) {
  const fr = langue !== "EN"

  return (
    <Html lang={fr ? "fr" : "en"}>
      <Head>
        <Font fontFamily="DM Sans" fallbackFontFamily="Arial" webFont={{ url: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2", format: "woff2" }} fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>{fr ? `Formulaire de santé à compléter avant votre visite` : `Health form to complete before your visit`}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>

          <Section style={{ backgroundColor: couleur, borderRadius: "12px 12px 0 0", padding: "24px 32px" }}>
            <Text style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: "600", margin: 0 }}>
              {clinique}
            </Text>
          </Section>

          <Section style={{ backgroundColor: "#FFFFFF", padding: "32px", borderRadius: "0 0 12px 12px", border: "1px solid #E2E8F0", borderTop: "none" }}>
            <Text style={{ fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 8px 0" }}>
              {fr ? `Bonjour ${prenom},` : `Hello ${prenom},`}
            </Text>
            <Text style={{ color: "#475569", fontSize: "16px", margin: "0 0 24px 0" }}>
              {fr
                ? "Avant votre prochain rendez-vous, veuillez prendre quelques minutes pour compléter votre formulaire de santé."
                : "Before your next appointment, please take a few minutes to complete your health form."}
            </Text>

            <Section style={{ textAlign: "center" as const, margin: "0 0 28px 0" }}>
              <Button
                href={lien}
                style={{
                  backgroundColor: couleur,
                  color: "#FFFFFF",
                  borderRadius: "8px",
                  padding: "14px 28px",
                  fontSize: "15px",
                  fontWeight: "600",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {fr ? `Remplir le formulaire` : `Complete the form`}
              </Button>
            </Section>

            <Text style={{ color: "#94A3B8", fontSize: "13px", margin: "0 0 4px 0", textAlign: "center" as const }}>
              {fr ? "Formulaire :" : "Form:"} {nomFormulaire}
            </Text>
            <Text style={{ color: "#94A3B8", fontSize: "12px", wordBreak: "break-all" as const, textAlign: "center" as const, margin: "0 0 24px 0" }}>
              {lien}
            </Text>

            <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />

            <Text style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>
              {fr ? "Ce lien expire dans 72 heures." : "This link expires in 72 hours."}
              {telephone ? (fr ? ` Questions : ${telephone}` : ` Questions: ${telephone}`) : ""}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default FormulaireEmail