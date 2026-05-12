import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

async function getOrg(clerkOrgId: string) {
  return db.organisation.findUnique({
    where: { clerkOrgId },
    select: { nom: true, courriel: true, telephone: true, adresse: true, ville: true, couleurPrimaire: true },
  })
}

export default async function PolitiqueConfidentialitePage() {
  const { orgId } = await auth()
  if (!orgId) notFound()

  const org = await getOrg(orgId)
  if (!org) notFound()

  const today = format(new Date(), "d MMMM yyyy", { locale: fr })
  const couleur = org.couleurPrimaire ?? "#2563EB"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-lg font-semibold" style={{ color: couleur }}>{org.nom}</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Politique de confidentialité</h1>
          <p className="text-slate-500 mt-2">Dernière mise à jour : {today}</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">1. Responsable du traitement</h2>
            <p>
              {org.nom} est responsable de la collecte et du traitement de vos renseignements personnels, conformément à la <em>Loi sur la protection des renseignements personnels dans le secteur privé</em> (Loi 25, Québec).
            </p>
            {(org.adresse || org.ville) && (
              <p>Adresse : {[org.adresse, org.ville].filter(Boolean).join(", ")}</p>
            )}
            {org.courriel && <p>Courriel : <a href={`mailto:${org.courriel}`} style={{ color: couleur }}>{org.courriel}</a></p>}
            {org.telephone && <p>Téléphone : {org.telephone}</p>}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Renseignements collectés</h2>
            <p>Nous collectons les renseignements suivants :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nom, prénom, date de naissance</li>
              <li>Coordonnées (téléphone, courriel, adresse)</li>
              <li>Informations de santé (formulaires anamnèse, notes cliniques)</li>
              <li>Historique des rendez-vous et communications</li>
              <li>Consentements enregistrés avec horodatage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. Finalités du traitement</h2>
            <p>Vos renseignements sont utilisés pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>La gestion de vos rendez-vous et de votre dossier patient</li>
              <li>L'envoi de rappels de rendez-vous par SMS ou courriel (avec votre consentement)</li>
              <li>La collecte de formulaires anamnèse avant vos consultations</li>
              <li>La communication d'informations liées à votre suivi de santé</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Consentement</h2>
            <p>
              Nous collectons votre consentement explicite avant tout envoi de communications marketing. Les communications transactionnelles (confirmations de rendez-vous, rappels) sont envoyées dans le cadre de la prestation de soins.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Conservation des données</h2>
            <p>
              Vos renseignements sont conservés pendant la durée de votre relation avec {org.nom}, puis archivés selon les obligations légales applicables aux dossiers de santé au Québec (minimum 5 ans après la dernière consultation).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. Vos droits (Loi 25)</h2>
            <p>Vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Droit d'accès</strong> : obtenir une copie de vos renseignements personnels</li>
              <li><strong>Droit de rectification</strong> : corriger des informations inexactes</li>
              <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données sous réserve des obligations légales</li>
              <li><strong>Droit de retrait du consentement</strong> : retirer votre consentement aux communications à tout moment</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à{" "}
              {org.courriel
                ? <a href={`mailto:${org.courriel}`} style={{ color: couleur }}>{org.courriel}</a>
                : "l'adresse fournie ci-dessus"
              }.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Sécurité</h2>
            <p>
              Vos données sont hébergées sur des serveurs sécurisés (chiffrement TLS en transit, chiffrement au repos). L'accès est restreint au personnel autorisé de {org.nom}.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">8. Plaintes</h2>
            <p>
              Si vous estimez que vos droits n'ont pas été respectés, vous pouvez déposer une plainte auprès de la{" "}
              <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" style={{ color: couleur }}>
                Commission d'accès à l'information du Québec (CAI)
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
