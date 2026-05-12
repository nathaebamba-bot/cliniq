"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ShieldCheck, CheckCircle2, XCircle, Trash2 } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export function ConformiteTab() {
  const { data: consentements, isLoading: consLoading } = trpc.conformite.consentements.useQuery({ limit: 100, offset: 0 })
  const { data: suppressions, isLoading: suppLoading } = trpc.conformite.logSuppressions.useQuery()

  const totalConsentSMS = consentements?.items.filter((p) => p.consentementSMS).length ?? 0
  const totalConsentCourriel = consentements?.items.filter((p) => p.consentementCourriel).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header info */}
      <Card className="border-brand-primary/20 bg-blue-50/30">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Conformité Loi 25 (Québec)</p>
              <p className="text-sm text-text-secondary mt-1">
                Cette section vous permet de gérer les consentements, d'exporter ou supprimer les données patients conformément à la Loi sur la protection des renseignements personnels dans le secteur privé.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-display font-semibold text-text-primary">{consentements?.total ?? "—"}</p>
            <p className="text-sm text-text-tertiary mt-1">Patients avec consentement enregistré</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-display font-semibold text-brand-accent">{totalConsentSMS}</p>
            <p className="text-sm text-text-tertiary mt-1">Consentements SMS actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-display font-semibold text-brand-primary">{totalConsentCourriel}</p>
            <p className="text-sm text-text-tertiary mt-1">Consentements courriel actifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Consent log */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Registre des consentements</CardTitle>
        </CardHeader>
        <CardContent>
          {consLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !consentements?.items.length ? (
            <p className="text-sm text-text-tertiary text-center py-4">Aucun consentement enregistré.</p>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto pr-1">
              {consentements.items.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.prenom} {p.nom}</p>
                    <p className="text-xs text-text-tertiary">
                      {p.telephone}
                      {p.consentementDate && ` · ${format(new Date(p.consentementDate), "d MMM yyyy", { locale: fr })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs">
                      {p.consentementSMS
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-accent" />
                        : <XCircle className="h-3.5 w-3.5 text-text-tertiary" />}
                      SMS
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      {p.consentementCourriel
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-accent" />
                        : <XCircle className="h-3.5 w-3.5 text-text-tertiary" />}
                      Courriel
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deletion log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-text-secondary" />
            <CardTitle className="font-display text-base">Journal des suppressions (anonymisé)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {suppLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !suppressions?.length ? (
            <p className="text-sm text-text-tertiary text-center py-4">Aucune suppression enregistrée.</p>
          ) : (
            <div className="divide-y divide-border">
              {suppressions.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3">
                  <p className="text-sm text-text-secondary">{log.motif ?? "Suppression manuelle"}</p>
                  <p className="text-xs text-text-tertiary">{format(new Date(log.createdAt), "d MMM yyyy HH:mm", { locale: fr })}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy policy link */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Politique de confidentialité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-secondary">
            Une page de politique de confidentialité est automatiquement générée pour votre clinique et accessible publiquement.
          </p>
          <a
            href="/politique-de-confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-primary hover:underline"
          >
            Voir la politique de confidentialité →
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
