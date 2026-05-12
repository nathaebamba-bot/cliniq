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
  montant: string
  portailUrl: string
}

export default function EmailPaiementEchec({ nomClinique, nomUtilisateur, montant, portailUrl }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Action requise — paiement échoué pour {nomClinique}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8F0" }}>
          <Section style={{ backgroundColor: "#EF4444", padding: "32px 40px" }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 24 }}>Cliniq</Heading>
          </Section>
          <Section style={{ padding: "32px 40px" }}>
            <Heading as="h2" style={{ color: "#0F172A", fontSize: 20, marginTop: 0 }}>
              Paiement échoué
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Bonjour {nomUtilisateur}, le paiement de <strong>{montant}</strong> pour le compte <strong>{nomClinique}</strong> a échoué.
              Veuillez mettre à jour votre moyen de paiement pour maintenir l'accès à votre tableau de bord.
            </Text>
            <Button
              href={portailUrl}
              style={{
                backgroundColor: "#EF4444",
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
              Mettre à jour mon paiement
            </Button>
            <Hr style={{ borderColor: "#E2E8F0", margin: "32px 0" }} />
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              Si vous avez des questions, contactez-nous à support@cliniq.app
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
