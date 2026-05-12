import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
  Preview,
} from "@react-email/components"

interface Props {
  nomClinique: string
  nomUtilisateur: string
  dateExpiration: string
}

export default function EmailAbonnementAnnule({ nomClinique, nomUtilisateur, dateExpiration }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Abonnement annulé — {nomClinique}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "DM Sans, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8F0" }}>
          <Section style={{ backgroundColor: "#475569", padding: "32px 40px" }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 24 }}>Cliniq</Heading>
          </Section>
          <Section style={{ padding: "32px 40px" }}>
            <Heading as="h2" style={{ color: "#0F172A", fontSize: 20, marginTop: 0 }}>
              Votre abonnement a été annulé
            </Heading>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Bonjour {nomUtilisateur}, l'abonnement de <strong>{nomClinique}</strong> a été annulé.
              Votre accès reste actif jusqu'au <strong>{dateExpiration}</strong>.
            </Text>
            <Text style={{ color: "#475569", lineHeight: 1.6 }}>
              Vos données sont conservées pendant 90 jours. Pour réactiver votre compte, contactez-nous à support@cliniq.app.
            </Text>
            <Hr style={{ borderColor: "#E2E8F0", margin: "32px 0" }} />
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              Merci d'avoir utilisé Cliniq. Nous espérons vous revoir bientôt.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
