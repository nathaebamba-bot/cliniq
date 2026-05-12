import { createTRPCRouter } from "@/server/trpc"
import { organisationRouter } from "@/server/routers/organisation"
import { praticienRouter } from "@/server/routers/praticien"
import { patientRouter } from "@/server/routers/patient"
import { rendezVousRouter } from "@/server/routers/rendez-vous"
import { automatisationRouter } from "@/server/routers/automatisation"
import { formulaireRouter } from "@/server/routers/formulaire"
import { dashboardRouter } from "@/server/routers/dashboard"
import { avisRouter } from "@/server/routers/avis"
import { rapportRouter } from "@/server/routers/rapport"
import { stripeRouter } from "@/server/routers/stripe"
import { conformiteRouter } from "@/server/routers/conformite"
import { searchRouter } from "@/server/routers/search"
import { listeAttenteRouter } from "@/server/routers/liste-attente"
import { factureRouter } from "@/server/routers/facture"
import { catalogueServiceRouter } from "@/server/routers/catalogue-service"

export const appRouter = createTRPCRouter({
  organisation: organisationRouter,
  praticien: praticienRouter,
  patient: patientRouter,
  rendezVous: rendezVousRouter,
  automatisation: automatisationRouter,
  formulaire: formulaireRouter,
  dashboard: dashboardRouter,
  avis: avisRouter,
  rapport: rapportRouter,
  stripe: stripeRouter,
  conformite: conformiteRouter,
  search: searchRouter,
  listeAttente: listeAttenteRouter,
  facture: factureRouter,
  catalogueService: catalogueServiceRouter,
})

export type AppRouter = typeof appRouter
