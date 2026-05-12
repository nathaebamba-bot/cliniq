import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components"

interface Props {
  nomClinique: string
  nomUtilisateur: string
  forfait: string
  appUrl: string
}

export default function EmailBienvenue({ nomClinique, nomUtilisateur, forfait, appUrl }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Bienvenue sur Cliniq — votre compte est activé</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8F0" }}>
          <Section style={{ backgroundColor: "#2563EB", padding: "32px 40px" }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 24 }}>Cliniq</Heading>
          </Section>
          <Section style={{ padding: "32px 40px" }}>
            <Heading as="h2" style={{ color: "#0F172A", fontSize: 20, marginTop: 0 }}>
              Bienvenue, {nomUtilisateur} !
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Votre compte <strong>{nomClinique}</strong> est maintenant actif avec le forfait <strong>{forfait}</strong>.
              Vous pouvez commencer à automatiser vos rappels de rendez-vous et réduire vos no-shows dès aujourd'hui.
            </Text>
            <Button
              href={appUrl}
              style={{
                backgroundColor: "#2563EB",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-block",
                marginTop: 8,
              }}
            >
              Accéder au tableau de bord
            </Button>
            <Hr style={{ borderColor: "#E2E8F0", margin: "32px 0" }} />
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              Cliniq · Automatisation pour cliniques de santé privées au Québec
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
