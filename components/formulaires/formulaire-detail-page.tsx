"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Pencil, ChevronDown, ChevronRight } from "lucide-react"
import { trpc } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormulaireBuilder } from "./formulaire-builder"
import type { Question, ReponseMap } from "@/types/formulaire"

interface Props {
  formulaireId: string
}

export function FormulaireDetailPage({ formulaireId }: Props) {
  const [editMode, setEditMode] = useState(false)
  const { data, isLoading } = trpc.formulaire.getById.useQuery({ id: formulaireId })

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
  if (!data) return null

  if (editMode) {
    return (
      <div className="p-6 h-full">
        <FormulaireBuilder formulaire={data} />
      </div>
    )
  }

  const questions = data.questions as unknown as Question[]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">{data.nom}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {questions.length} question{questions.length !== 1 ? "s" : ""} ·{" "}
            {data.reponses.length} réponse{data.reponses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditMode(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Modifier
        </Button>
      </div>

      <Tabs defaultValue="reponses">
        <TabsList>
          <TabsTrigger value="reponses">Réponses ({data.reponses.length})</TabsTrigger>
          <TabsTrigger value="apercu">Aperçu du formulaire</TabsTrigger>
        </TabsList>

        <TabsContent value="reponses" className="mt-4">
          {data.reponses.length === 0 ? (
            <div className="text-center py-16 text-text-tertiary rounded-card border border-border">
              Aucune réponse pour ce formulaire.
            </div>
          ) : (
            <div className="space-y-3">
              {data.reponses.map((r) => (
                <ReponseCard key={r.id} reponse={r} questions={questions} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="apercu" className="mt-4">
          <div className="max-w-2xl space-y-3">
            {questions.map((q) => (
              <div key={q.id} className={q.type === "section" ? "pt-4" : "rounded-card border border-border p-4"}>
                {q.type === "section" ? (
                  <h3 className="font-semibold text-lg border-b border-border pb-2">{q.question}</h3>
                ) : (
                  <div>
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-medium flex-1">{q.question}</p>
                      {q.obligatoire && <Badge className="text-xs bg-red-50 text-red-600 border-0">Requis</Badge>}
                    </div>
                    <p className="text-xs text-text-tertiary mt-1 capitalize">{q.type.replace("-", " ")}</p>
                    {q.options && (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {q.options.map((opt) => (
                          <Badge key={opt} variant="outline" className="text-xs">{opt}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReponseCard({
  reponse,
  questions,
}: {
  reponse: {
    id: string
    completeLe: Date | null
    createdAt: Date
    reponses: unknown
    patient: { prenom: string; nom: string; telephone: string }
  }
  questions: Question[]
}) {
  const [open, setOpen] = useState(false)
  const reponsesMap = reponse.reponses as ReponseMap

  return (
    <Card className="overflow-hidden">
      <CardContent
        className="p-4 cursor-pointer hover:bg-bg-secondary/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {reponse.patient.prenom} {reponse.patient.nom}
            </p>
            <p className="text-sm text-text-secondary">
              {reponse.completeLe
                ? `Complété le ${format(new Date(reponse.completeLe), "d MMM yyyy 'à' HH:mm", { locale: fr })}`
                : `Envoyé le ${format(new Date(reponse.createdAt), "d MMM yyyy", { locale: fr })} — en attente`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={reponse.completeLe ? "bg-green-100 text-green-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>
              {reponse.completeLe ? "Complété" : "En attente"}
            </Badge>
            {open ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
          </div>
        </div>
      </CardContent>

      {open && reponse.completeLe && (
        <div className="border-t border-border">
          <div className="p-4 space-y-3">
            {questions
              .filter((q) => q.type !== "section")
              .map((q) => {
                const val = reponsesMap[q.id]
                if (val === null || val === undefined) return null
                return (
                  <div key={q.id}>
                    <p className="text-xs font-medium text-text-secondary">{q.question}</p>
                    <p className="text-sm mt-0.5">
                      {Array.isArray(val) ? val.join(", ") : String(val)}
                    </p>
                    {/* Alert on allergy detection */}
                    {q.question.toLowerCase().includes("allergi") && (val === "oui" || (Array.isArray(val) && val.length > 0)) && (
                      <p className="text-xs text-red-600 mt-0.5 font-medium">⚠ Allergie détectée</p>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </Card>
  )
}
