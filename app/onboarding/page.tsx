"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser, useOrganizationList } from "@clerk/nextjs"
import { Building2, ChevronRight, Loader2, Users } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { TypeClinique } from "@prisma/client"

const TYPES_CLINIQUE = [
  { value: "DENTAIRE", label: "Clinique dentaire" },
  { value: "PHYSIOTHERAPIE", label: "Physiothérapie" },
  { value: "PSYCHOLOGIE", label: "Psychologie" },
  { value: "MASSOTHERAPIE", label: "Massothérapie" },
  { value: "OPTOMETRIE", label: "Optométrie" },
  { value: "MEDECINE_GENERALE", label: "Médecine générale" },
  { value: "AUTRE", label: "Autre" },
]

export default function OnboardingPage() {
  const { user } = useUser()
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const router = useRouter()

  const [nom, setNom] = useState("")
  const [type, setType] = useState("")
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const upsertOrg = trpc.organisation.upsert.useMutation()

  const memberships = userMemberships?.data ?? []
  const hasMemberships = memberships.length > 0

  const handleJoin = async (orgId: string) => {
    if (!setActive) return
    setJoiningId(orgId)
    try {
      await setActive({ organization: orgId })
      await new Promise((r) => setTimeout(r, 800))
      router.push("/dashboard")
    } catch {
      toast.error("Impossible d'activer cette organisation.")
      setJoiningId(null)
    }
  }

  const handleCreate = async () => {
    if (!nom.trim() || !type) {
      toast.error("Veuillez remplir tous les champs.")
      return
    }
    if (!createOrganization || !setActive) return

    setLoading(true)
    try {
      const org = await createOrganization({ name: nom.trim() })
      await setActive({ organization: org.id })

      // Wait for Clerk session to refresh, then persist the clinic type
      // (the webhook creates the org with type AUTRE as a fallback)
      await new Promise((r) => setTimeout(r, 1000))
      await upsertOrg.mutateAsync({ nom: nom.trim(), type: type as TypeClinique }).catch(() => null)

      router.push("/dashboard")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création."
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 mb-4">
            <Building2 className="h-7 w-7 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {hasMemberships ? "Accéder à votre clinique" : "Créez votre clinique"}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Bonjour {user?.firstName ?? ""}!{" "}
            {hasMemberships
              ? "Sélectionnez la clinique à laquelle vous souhaitez accéder."
              : "Configurons votre espace en quelques secondes."}
          </p>
        </div>

        {/* Existing memberships */}
        {hasMemberships && (
          <div className="bg-bg-primary rounded-xl border border-border p-4 shadow-sm space-y-2">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide px-1 pb-1">
              Vos organisations
            </p>
            {memberships.map((m) => (
              <button
                key={m.organization.id}
                onClick={() => handleJoin(m.organization.id)}
                disabled={joiningId === m.organization.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-primary/10 shrink-0">
                  <Users className="h-4 w-4 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {m.organization.name}
                  </p>
                  <p className="text-xs text-text-secondary capitalize">{m.role}</p>
                </div>
                {joiningId === m.organization.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Create new org (only show if no memberships, or as secondary option) */}
        {!hasMemberships && (
          <div className="bg-bg-primary rounded-xl border border-border p-6 shadow-sm space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="nom">Nom de la clinique</Label>
              <Input
                id="nom"
                placeholder="Ex: Clinique Santé Plus"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type de clinique</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un type…" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_CLINIQUE.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={loading || !nom.trim() || !type}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Continuer vers le tableau de bord
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-text-tertiary mt-4">
          Vous pouvez modifier ces informations plus tard dans les paramètres.
        </p>
      </div>
    </div>
  )
}
