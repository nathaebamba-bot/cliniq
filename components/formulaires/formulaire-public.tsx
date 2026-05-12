"use client"

import { useState, useMemo } from "react"
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import type { Question, ReponseMap } from "@/types/formulaire"

interface Props {
  token: string
}

export function FormulairePublic({ token }: Props) {
  const { data, isLoading, error } = trpc.formulaire.chargerFormulaire.useQuery({ token })

  const [reponses, setReponses] = useState<ReponseMap>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [validationError, setValidationError] = useState("")

  const soumettreM = trpc.formulaire.soumettre.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error(e.message),
  })

  // Build visible questions (skip sections, apply conditions)
  const visibleQuestions = useMemo<Question[]>(() => {
    if (!data) return []
    return data.formulaire.questions.filter((q) => {
      if (q.type === "section") return false
      if (q.condition) {
        const val = reponses[q.condition.questionId]
        return val === q.condition.reponse
      }
      return true
    })
  }, [data, reponses])

  const currentQuestion = visibleQuestions[currentIndex]
  const progress = visibleQuestions.length > 0 ? ((currentIndex) / visibleQuestions.length) * 100 : 0
  const isLast = currentIndex === visibleQuestions.length - 1

  const validate = (): boolean => {
    if (!currentQuestion) return true
    if (currentQuestion.obligatoire) {
      const val = reponses[currentQuestion.id]
      if (val === null || val === undefined || val === "") {
        setValidationError("Cette réponse est obligatoire.")
        return false
      }
      if (Array.isArray(val) && val.length === 0) {
        setValidationError("Veuillez sélectionner au moins une option.")
        return false
      }
    }
    setValidationError("")
    return true
  }

  const next = () => {
    if (!validate()) return
    if (isLast) {
      soumettreM.mutate({ token, reponses: reponses as Record<string, unknown> })
    } else {
      setCurrentIndex((i) => i + 1)
      setValidationError("")
    }
  }

  const prev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1))
    setValidationError("")
  }

  const setReponse = (id: string, val: string | string[] | number | boolean | null) => {
    setReponses((r) => ({ ...r, [id]: val }))
    setValidationError("")
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    )
  }

  // ── Error / expired ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <ErrorPage
        message={
          error?.message === "Lien expiré"
            ? "Ce lien est expiré."
            : "Ce lien est invalide ou introuvable."
        }
        telephone={data?.org?.telephone}
      />
    )
  }

  // ── Already submitted ──────────────────────────────────────────────────────
  if (data.reponse.completeLe || submitted) {
    return (
      <SuccessPage
        nom={data.patient.prenom}
        orgNom={data.org?.nom ?? "la clinique"}
        couleur={data.org?.couleurPrimaire ?? "#2563EB"}
      />
    )
  }

  const couleur = data.org?.couleurPrimaire ?? "#2563EB"

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <p className="font-semibold text-slate-900" style={{ color: couleur }}>
            {data.org?.nom ?? "Cliniq"}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">{data.formulaire.nom}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-1 transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: couleur }}
        />
      </div>

      {/* Question counter */}
      <div className="max-w-lg mx-auto w-full px-4 py-2">
        <p className="text-xs text-slate-400">
          Question {currentIndex + 1} sur {visibleQuestions.length}
        </p>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full px-4 pb-6">
        {currentQuestion && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 leading-snug">
                {currentQuestion.question}
                {currentQuestion.obligatoire && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>
            </div>

            <QuestionInput
              question={currentQuestion}
              value={reponses[currentQuestion.id] ?? null}
              onChange={(val) => setReponse(currentQuestion.id, val)}
              couleur={couleur}
            />

            {validationError && (
              <p className="text-sm text-red-500">{validationError}</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentIndex > 0 && (
            <Button variant="outline" onClick={prev} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
          )}
          <Button
            className="flex-1 text-white"
            style={{ backgroundColor: couleur }}
            onClick={next}
            disabled={soumettreM.isPending}
          >
            {soumettreM.isPending ? "Envoi…" : isLast ? "Confirmer et envoyer" : (
              <>Suivant <ChevronRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Question input renderer ────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
  couleur,
}: {
  question: Question
  value: ReponseMap[string]
  onChange: (val: string | string[] | number | boolean | null) => void
  couleur: string
}) {
  const strVal = typeof value === "string" ? value : ""
  const arrVal = Array.isArray(value) ? value : []
  const numVal = typeof value === "number" ? value : null

  switch (question.type) {
    case "text-court":
      return (
        <Input
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Votre réponse…"
          className="text-base h-12"
          autoFocus
        />
      )

    case "text-long":
      return (
        <Textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Votre réponse…"
          rows={4}
          className="text-base resize-none"
          autoFocus
        />
      )

    case "oui-non":
      return (
        <div className="flex gap-3">
          {["oui", "non"].map((opt) => (
            <button
              key={opt}
              className={`flex-1 py-4 rounded-xl border-2 text-lg font-semibold capitalize transition-all ${
                value === opt
                  ? "border-transparent text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={value === opt ? { backgroundColor: couleur, borderColor: couleur } : {}}
              onClick={() => onChange(opt)}
            >
              {opt === "oui" ? "✓ Oui" : "✗ Non"}
            </button>
          ))}
        </div>
      )

    case "choix-multiple":
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                value === opt
                  ? "border-transparent text-white"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 bg-white"
              }`}
              style={value === opt ? { backgroundColor: couleur, borderColor: couleur } : {}}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )

    case "cases-cocher":
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Checkbox
                checked={arrVal.includes(opt)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked ? [...arrVal, opt] : arrVal.filter((v) => v !== opt)
                  )
                }}
              />
              <span className="text-sm font-medium text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )

    case "echelle": {
      const min = question.min ?? 0
      const max = question.max ?? 10
      const scale = Array.from({ length: max - min + 1 }, (_, i) => i + min)
      return (
        <div>
          <div className="flex gap-2 flex-wrap justify-center">
            {scale.map((n) => (
              <button
                key={n}
                className={`h-12 w-12 rounded-full border-2 font-semibold text-sm transition-all ${
                  numVal === n
                    ? "border-transparent text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                }`}
                style={numVal === n ? { backgroundColor: couleur, borderColor: couleur } : {}}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
            <span>{min} — Aucune</span>
            <span>{max} — Maximum</span>
          </div>
        </div>
      )
    }

    case "date":
      return (
        <Input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="text-base h-12"
        />
      )

    default:
      return null
  }
}

// ── Success page ───────────────────────────────────────────────────────────────

function SuccessPage({ nom, orgNom, couleur }: { nom: string; orgNom: string; couleur: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div
        className="h-20 w-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: couleur + "20" }}
      >
        <CheckCircle className="h-10 w-10" style={{ color: couleur }} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Merci, {nom} !</h1>
      <p className="text-slate-500 max-w-sm">
        Votre formulaire a été envoyé à <strong>{orgNom}</strong>. Votre praticien pourra le consulter avant votre rendez-vous.
      </p>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 max-w-sm w-full">
        <p className="text-sm text-slate-500">
          Vous pouvez fermer cette page. À bientôt !
        </p>
      </div>
    </div>
  )
}

// ── Error page ─────────────────────────────────────────────────────────────────

function ErrorPage({ message, telephone }: { message: string; telephone?: string | null }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien invalide</h1>
      <p className="text-slate-500 max-w-sm">{message}</p>
      {telephone && (
        <a
          href={`tel:${telephone}`}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium text-sm"
        >
          Appeler la clinique
        </a>
      )}
    </div>
  )
}
