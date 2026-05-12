"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Phone, Mail, Edit, AlertTriangle, UserX, UserCheck, Download, Trash2, ShieldCheck, Send, Star, Plus, Shield } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PatientForm } from "./patient-form"
import { StatutBadge } from "./statut-badge"
import { RdvDrawer } from "@/components/rendez-vous/rdv-drawer"
import { NouveauRdvModal } from "@/components/rendez-vous/nouveau-rdv-modal"
import type { CanalCommunication, StatutCommunication, TypeCommunication, StatutRdv } from "@prisma/client"

const CANAL_LABELS: Record<CanalCommunication, string> = {
  SMS: "SMS",
  COURRIEL: "Courriel",
  VOCAL: "Vocal",
}

const STATUT_COMM_CLASS: Record<StatutCommunication, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600",
  ENVOYE: "bg-blue-100 text-blue-600",
  DELIVRE: "bg-blue-100 text-blue-700",
  LU: "bg-indigo-100 text-indigo-700",
  ECHEC: "bg-red-100 text-red-700",
  REPONDU: "bg-green-100 text-green-700",
}

const TYPE_COMM_LABELS: Record<TypeCommunication, string> = {
  RAPPEL_RDV: "Rappel RDV",
  CONFIRMATION_RDV: "Confirmation RDV",
  FORMULAIRE_ANAMNE: "Formulaire anamnèse",
  COLLECTE_AVIS: "Collecte d'avis",
  RELANCE_TRAITEMENT: "Relance traitement",
  RAPPEL_HYGIENE: "Rappel hygiène",
  CAMPAGNE_MARKETING: "Campagne marketing",
  REPONSE_ENTRANTE: "Réponse du patient",
}

interface Props {
  patientId: string
}

export function PatientDetail({ patientId }: Props) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [selectedRdv, setSelectedRdv] = useState<{
    id: string; dateHeure: Date; dureeMinutes: number; typeRdv: string | null
    notes: string | null; statut: StatutRdv
    patient: { id: string; prenom: string; nom: string; telephone: string }
    praticien: { id: string; prenom: string; nom: string; couleur: string | null }
  } | null>(null)
  const [showNouveauRdv, setShowNouveauRdv] = useState(false)
  const [showEnvoyerFormulaire, setShowEnvoyerFormulaire] = useState(false)
  const [selectedFormulaireId, setSelectedFormulaireId] = useState("")
  const [formulaireUrl, setFormulaireUrl] = useState<string | null>(null)
  const [linkAlreadyExisted, setLinkAlreadyExisted] = useState(false)
  const [avisRdvId, setAvisRdvId] = useState<string | null>(null)

  const { data: patient, isLoading } = trpc.patient.getById.useQuery({ id: patientId })
  const { data: auditLog } = trpc.conformite.auditLog.useQuery({ patientId }, { enabled: !!patientId })
  const { data: formulairesDisponibles } = trpc.formulaire.liste.useQuery(undefined, { enabled: showEnvoyerFormulaire })

  const envoyerFormulaireMutation = trpc.formulaire.envoyerAuPatient.useMutation({
    onSuccess: (data) => {
      utils.patient.getById.invalidate({ id: patientId })

      if (data.alreadyExists) {
        toast.warning("Un formulaire a déjà été envoyé il y a moins de 24h.", { duration: 6000 })
        setLinkAlreadyExisted(true)
        setFormulaireUrl(data.url)
        return
      }

      const sentChannels = [data.smsSent && "SMS", data.emailSent && "courriel"].filter(Boolean).join(" et ")
      if (sentChannels) {
        toast.success(`Formulaire envoyé par ${sentChannels}.`)
        setShowEnvoyerFormulaire(false)
        setSelectedFormulaireId("")
        setFormulaireUrl(null)
        setLinkAlreadyExisted(false)
        return
      }

      // Nothing sent — show link for manual copy
      if (data.smsError) {
        toast.error(`SMS non envoyé — erreur Twilio : ${data.smsError}`, { duration: 10000 })
      }
      setLinkAlreadyExisted(false)
      setFormulaireUrl(data.url)
    },
    onError: (e) => toast.error(e.data?.code === "NOT_FOUND" ? e.message : `Erreur : ${e.message}`),
  })

  const envoyerAvisMutation = trpc.avis.envoyerAvisManuel.useMutation({
    onSuccess: (data) => {
      setAvisRdvId(null)
      utils.patient.getById.invalidate({ id: patientId })
      if (data.smsSent) {
        toast.success("Demande d'avis Google envoyée par SMS.")
      } else {
        toast.error("Patient sans consentement SMS ou numéro manquant.")
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const archiverMutation = trpc.patient.archiver.useMutation({
    onSuccess: () => {
      utils.patient.getById.invalidate({ id: patientId })
      utils.patient.liste.invalidate()
      toast.success(patient?.actif ? "Patient archivé." : "Patient réactivé.")
    },
    onError: (e) => toast.error(e.message),
  })

  const supprimerMutation = trpc.conformite.supprimerPatient.useMutation({
    onSuccess: () => {
      toast.success("Patient supprimé définitivement.")
      utils.patient.liste.invalidate()
      router.push("/patients")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: exportData, refetch: fetchExport } = trpc.conformite.exportPatient.useQuery(
    { patientId },
    { enabled: false }
  )

  const handleExport = async () => {
    const result = await fetchExport()
    if (!result.data) return
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `patient-${patientId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Données exportées.")
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-20 text-text-tertiary">
        Patient introuvable.
        <Button variant="link" onClick={() => router.push("/patients")}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  const initials = `${patient.prenom[0]}${patient.nom[0]}`.toUpperCase()
  const noShows = patient.rendezvous.filter((r) => r.statut === "NO_SHOW").length

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/patients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-start gap-4 flex-1">
          <Avatar className="h-14 w-14 text-lg">
            <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-semibold">
                {patient.prenom} {patient.nom}
              </h1>
              <Badge className={patient.actif ? "bg-green-100 text-green-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
                {patient.actif ? "Actif" : "Inactif"}
              </Badge>
              {noShows > 0 && (
                <Badge className="bg-red-100 text-red-700 border-0">
                  {noShows} no-show{noShows > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {patient.telephone}
              </span>
              {patient.courriel && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {patient.courriel}
                </span>
              )}
              <Badge variant="outline" className="text-xs">{patient.langue}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Edit className="h-4 w-4 mr-1.5" /> Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={patient.actif ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-600"}
              onClick={() => archiverMutation.mutate({ id: patient.id, actif: !patient.actif })}
            >
              {patient.actif ? <UserX className="h-4 w-4 mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
              {patient.actif ? "Archiver" : "Réactiver"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" /> Exporter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Supprimer
            </Button>
          </div>
        </div>
      </div>

      {/* Alertes médicales */}
      {patient.alertes && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{patient.alertes}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="rendezvous">
            Rendez-vous ({patient.rendezvous.length})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Communications ({patient.communications.length})
          </TabsTrigger>
          <TabsTrigger value="formulaires">
            Formulaires ({patient.formulaires.length})
          </TabsTrigger>
          <TabsTrigger value="consentements">Consentements</TabsTrigger>
        </TabsList>

        {/* ── Résumé ── */}
        <TabsContent value="resume" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informations de contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Prénom" value={patient.prenom} />
                <Row label="Nom" value={patient.nom} />
                <Row label="Téléphone" value={patient.telephone} mono />
                <Row label="Courriel" value={patient.courriel ?? "—"} />
                <Row
                  label="Date de naissance"
                  value={
                    patient.dateNaissance
                      ? format(new Date(patient.dateNaissance), "d MMMM yyyy", { locale: fr })
                      : "—"
                  }
                />
                <Row
                  label="Sexe"
                  value={
                    patient.sexe === "M" ? "Homme" :
                    patient.sexe === "F" ? "Femme" :
                    patient.sexe === "AUTRE" ? "Autre" :
                    "—"
                  }
                />
                <Row label="Langue" value={patient.langue === "FR" ? "Français" : "English"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Total rendez-vous" value={String(patient.rendezvous.length)} />
                <Row label="No-shows" value={String(noShows)} />
                <Row
                  label="Dernier rendez-vous"
                  value={
                    patient.rendezvous[0]
                      ? format(new Date(patient.rendezvous[0].dateHeure), "d MMM yyyy", { locale: fr })
                      : "—"
                  }
                />
                <Row label="Patient depuis" value={format(new Date(patient.createdAt), "d MMM yyyy", { locale: fr })} />
              </CardContent>
            </Card>

            {/* Insurance card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-text-tertiary" />
                  Assurance privée
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!(patient as any).assuranceStatut ? (
                  <p className="text-text-tertiary text-xs">Non renseigné</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          (patient as any).assuranceStatut === "OUI"
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700"
                            : (patient as any).assuranceStatut === "NON"
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
                            : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"
                        }
                      >
                        {(patient as any).assuranceStatut === "OUI"
                          ? "Assuré(e)"
                          : (patient as any).assuranceStatut === "NON"
                          ? "Sans assurance"
                          : "Inconnu"}
                      </span>
                      {(patient as any).assuranceConsente && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                          <ShieldCheck className="h-3 w-3" /> Consentement
                        </span>
                      )}
                    </div>
                    {(patient as any).assuranceStatut === "OUI" && (
                      <>
                        {(patient as any).assuranceNom && (
                          <Row label="Assureur" value={(patient as any).assuranceNom} />
                        )}
                        {(patient as any).assuranceNumPolice && (
                          <Row label="N° de police" value={(patient as any).assuranceNumPolice} mono />
                        )}
                        {(patient as any).assuranceNumMembre && (
                          <Row label="N° de membre" value={(patient as any).assuranceNumMembre} mono />
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {patient.notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes internes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{patient.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Rendez-vous ── */}
        <TabsContent value="rendezvous" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowNouveauRdv(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nouveau RDV
            </Button>
          </div>
          <div className="rounded-card border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Date et heure</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Praticien</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Durée</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Statut</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {patient.rendezvous.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-text-tertiary">
                      Aucun rendez-vous.
                    </td>
                  </tr>
                ) : (
                  patient.rendezvous.map((rdv) => (
                    <tr key={rdv.id} className="border-t border-border hover:bg-bg-secondary/50">
                      <td className="px-4 py-3 font-medium">
                        {format(new Date(rdv.dateHeure), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {rdv.praticien.prenom} {rdv.praticien.nom}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{rdv.typeRdv ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{rdv.dureeMinutes} min</td>
                      <td className="px-4 py-3"><StatutBadge statut={rdv.statut} /></td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          {rdv.statut === "COMPLETE" && !rdv.avisEnvoye && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-500 hover:text-amber-600"
                              title="Envoyer demande d'avis Google"
                              disabled={envoyerAvisMutation.isPending && avisRdvId === rdv.id}
                              onClick={() => {
                                setAvisRdvId(rdv.id)
                                envoyerAvisMutation.mutate({ patientId: patient.id, rendezvousId: rdv.id })
                              }}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedRdv({
                              ...rdv,
                              dateHeure: new Date(rdv.dateHeure),
                              patient: { id: patient.id, prenom: patient.prenom, nom: patient.nom, telephone: patient.telephone },
                            })}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Communications ── */}
        <TabsContent value="communications" className="mt-4">
          <div className="space-y-2">
            {patient.communications.length === 0 ? (
              <div className="text-center py-10 text-text-tertiary rounded-card border border-border">
                Aucune communication.
              </div>
            ) : (
              patient.communications.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{TYPE_COMM_LABELS[c.type]}</span>
                      <Badge className="text-xs border-0 bg-slate-100 text-slate-600">
                        {CANAL_LABELS[c.canal]}
                      </Badge>
                      <Badge className={`text-xs border-0 ${STATUT_COMM_CLASS[c.statut]}`}>
                        {c.statut}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed">{c.contenu}</p>
                    {c.reponsePatient && (
                      <p className="text-sm text-brand-primary mt-1 pl-3 border-l-2 border-brand-primary">
                        ↩ {c.reponsePatient}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary whitespace-nowrap">
                    {format(new Date(c.createdAt), "d MMM HH:mm", { locale: fr })}
                  </span>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Formulaires ── */}
        <TabsContent value="formulaires" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowEnvoyerFormulaire(true)}>
              <Send className="h-4 w-4 mr-1.5" /> Envoyer un formulaire
            </Button>
          </div>
          <div className="space-y-3">
            {patient.formulaires.length === 0 ? (
              <div className="text-center py-10 text-text-tertiary rounded-card border border-border">
                Aucun formulaire envoyé.
              </div>
            ) : (
              patient.formulaires.map((f) => (
                <Card key={f.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{f.formulaire.nom}</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                          {f.completeLe
                            ? `Complété le ${format(new Date(f.completeLe), "d MMM yyyy 'à' HH:mm", { locale: fr })}`
                            : "Non complété"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={f.completeLe ? "bg-green-100 text-green-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>
                          {f.completeLe ? "Complété" : "En attente"}
                        </Badge>
                        {f.completeLe && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/pdf/formulaire/${f.id}`, "_blank")}
                          >
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Consentements & Loi 25 ── */}
        <TabsContent value="consentements" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
                <CardTitle className="text-base">Consentements — Loi 25</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium mb-1">SMS</p>
                  <Badge className={patient.consentementSMS ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                    {patient.consentementSMS ? "Accordé" : "Non accordé"}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium mb-1">Courriel</p>
                  <Badge className={patient.consentementCourriel ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                    {patient.consentementCourriel ? "Accordé" : "Non accordé"}
                  </Badge>
                </div>
              </div>
              {patient.consentementDate && (
                <p className="text-text-secondary">
                  Consentement enregistré le{" "}
                  <strong>{format(new Date(patient.consentementDate), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</strong>
                </p>
              )}
              <p className="text-xs text-text-tertiary">Ce log est conservé à des fins de conformité Loi 25 (Québec).</p>
            </CardContent>
          </Card>

          {/* Audit log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Journal d'audit</CardTitle>
            </CardHeader>
            <CardContent>
              {!auditLog?.length ? (
                <p className="text-sm text-text-tertiary text-center py-4">Aucune modification enregistrée.</p>
              ) : (
                <div className="divide-y divide-border max-h-56 overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="text-sm font-medium text-text-primary">{entry.action}</span>
                        {entry.champModifie && (
                          <span className="text-xs text-text-tertiary ml-2">· {entry.champModifie}</span>
                        )}
                        <p className="text-xs text-text-tertiary mt-0.5">Utilisateur : {entry.userId.substring(0, 12)}…</p>
                      </div>
                      <p className="text-xs text-text-tertiary">
                        {format(new Date(entry.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le patient</DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={patient}
            onSuccess={() => {
              setShowEdit(false)
              utils.patient.getById.invalidate({ id: patientId })
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDelete} onOpenChange={(o) => { setShowDelete(o); if (!o) setDeleteConfirmation("") }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Supprimer définitivement ce patient</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes les données de ce patient (rendez-vous, communications, formulaires, avis) seront supprimées conformément au droit à l'effacement (Loi 25).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              Patient : <strong>{patient.prenom} {patient.nom}</strong> · {patient.telephone}
            </div>
            <div className="space-y-1">
              <Label>Tapez <strong>SUPPRIMER</strong> pour confirmer</Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="SUPPRIMER"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowDelete(false); setDeleteConfirmation("") }}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmation !== "SUPPRIMER" || supprimerMutation.isPending}
                onClick={() => supprimerMutation.mutate({ patientId: patient.id, confirmation: deleteConfirmation })}
              >
                {supprimerMutation.isPending ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Envoyer formulaire dialog */}
      <Dialog open={showEnvoyerFormulaire} onOpenChange={(o) => {
        setShowEnvoyerFormulaire(o)
        if (!o) { setSelectedFormulaireId(""); setFormulaireUrl(null); setLinkAlreadyExisted(false) }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer un formulaire</DialogTitle>
            <DialogDescription>
              {patient.consentementSMS && patient.consentementCourriel
                ? "Le lien sera envoyé par SMS et courriel."
                : patient.consentementSMS
                ? "Le lien sera envoyé par SMS."
                : patient.consentementCourriel
                ? "Le lien sera envoyé par courriel."
                : "Aucun consentement — un lien sera généré pour envoi manuel."}
            </DialogDescription>
          </DialogHeader>

          {formulaireUrl ? (
            /* ── Lien généré ou existant ── */
            <div className="space-y-3 py-2">
              {linkAlreadyExisted ? (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  Un formulaire actif a déjà été envoyé il y a moins de 24h. Voici le lien existant.
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Aucun canal d'envoi disponible. Copiez le lien et transmettez-le manuellement.
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Lien du formulaire</Label>
                <div className="flex gap-2">
                  <Input readOnly value={formulaireUrl} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(formulaireUrl)
                      toast.success("Lien copié !")
                    }}
                  >
                    Copier
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowEnvoyerFormulaire(false); setSelectedFormulaireId(""); setFormulaireUrl(null); setLinkAlreadyExisted(false) }}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* ── Sélection du formulaire ── */
            <>
              <div className="space-y-3 py-2">
                {formulairesDisponibles !== undefined && formulairesDisponibles.filter((f) => f.actif).length === 0 ? (
                  <div className="rounded-lg bg-slate-50 border border-border p-3 text-sm text-text-secondary">
                    Aucun formulaire actif. Allez dans{" "}
                    <a href="/formulaires" className="text-brand-primary underline">Formulaires</a>
                    {" "}pour créer ou importer les modèles pré-construits.
                  </div>
                ) : (
                  <>
                    <Label>Formulaire</Label>
                    <Select value={selectedFormulaireId} onValueChange={(v) => setSelectedFormulaireId(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un formulaire…" />
                      </SelectTrigger>
                      <SelectContent>
                        {formulairesDisponibles?.filter((f) => f.actif).map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {!patient.consentementSMS && !patient.consentementCourriel && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                    Aucun consentement enregistré. Le lien sera généré pour envoi manuel.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEnvoyerFormulaire(false)}>Annuler</Button>
                <Button
                  disabled={!selectedFormulaireId || envoyerFormulaireMutation.isPending}
                  onClick={() => envoyerFormulaireMutation.mutate({
                    formulaireId: selectedFormulaireId,
                    patientId: patient.id,
                  })}
                >
                  {envoyerFormulaireMutation.isPending
                    ? "Envoi…"
                    : patient.consentementSMS && patient.consentementCourriel
                    ? "Envoyer par SMS et courriel"
                    : patient.consentementSMS
                    ? "Envoyer par SMS"
                    : patient.consentementCourriel
                    ? "Envoyer par courriel"
                    : "Générer le lien"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* RDV drawer */}
      <RdvDrawer
        rdv={selectedRdv}
        open={!!selectedRdv}
        onOpenChange={(o) => { if (!o) setSelectedRdv(null) }}
      />

      {/* Nouveau RDV modal */}
      <NouveauRdvModal
        open={showNouveauRdv}
        onOpenChange={setShowNouveauRdv}
        defaultPatient={{ id: patient.id, prenom: patient.prenom, nom: patient.nom }}
        onSuccess={() => {
          setShowNouveauRdv(false)
          utils.patient.getById.invalidate({ id: patientId })
        }}
      />
    </>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
