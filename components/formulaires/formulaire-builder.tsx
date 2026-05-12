"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Plus, Save, ArrowLeft, Eye } from "lucide-react"
import { toast } from "sonner"
import { nanoid } from "nanoid"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { QuestionCard } from "./question-card"
import { PropertiesPanel } from "./properties-panel"
import type { Question, TypeQuestion } from "@/types/formulaire"
import { TYPE_LABELS } from "@/types/formulaire"
import type { Formulaire } from "@prisma/client"

const QUESTION_TYPES: { type: TypeQuestion; emoji: string }[] = [
  { type: "section",        emoji: "📌" },
  { type: "text-court",     emoji: "✏️" },
  { type: "text-long",      emoji: "📝" },
  { type: "oui-non",        emoji: "✅" },
  { type: "choix-multiple", emoji: "🔘" },
  { type: "cases-cocher",   emoji: "☑️" },
  { type: "echelle",        emoji: "📊" },
  { type: "date",           emoji: "📅" },
]

interface Props {
  formulaire?: Formulaire
}

export function FormulaireBuilder({ formulaire }: Props) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const [nom, setNom] = useState(formulaire?.nom ?? "Nouveau formulaire")
  const [questions, setQuestions] = useState<Question[]>(
    formulaire ? (formulaire.questions as unknown as Question[]) : []
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const createMutation = trpc.formulaire.create.useMutation({
    onSuccess: (data) => {
      utils.formulaire.liste.invalidate()
      toast.success("Formulaire créé.")
      router.push(`/formulaires/${data.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMutation = trpc.formulaire.update.useMutation({
    onSuccess: () => {
      utils.formulaire.liste.invalidate()
      utils.formulaire.getById.invalidate({ id: formulaire?.id })
      toast.success("Formulaire sauvegardé.")
    },
    onError: (e) => toast.error(e.message),
  })

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null

  const addQuestion = (type: TypeQuestion) => {
    const q: Question = {
      id: nanoid(),
      type,
      question: type === "section" ? "Nouvelle section" : "",
      obligatoire: type !== "section",
      options: type === "choix-multiple" || type === "cases-cocher" ? ["Option 1", "Option 2"] : undefined,
      min: type === "echelle" ? 0 : undefined,
      max: type === "echelle" ? 10 : undefined,
    }
    setQuestions((prev) => [...prev, q])
    setSelectedId(q.id)
  }

  const updateQuestion = useCallback((updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }, [])

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setQuestions((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const save = () => {
    if (!nom.trim()) { toast.error("Donnez un nom au formulaire."); return }
    if (questions.length === 0) { toast.error("Ajoutez au moins une question."); return }

    const payload = { nom, questions }

    if (formulaire) {
      updateMutation.mutate({ id: formulaire.id, ...payload })
    } else {
      createMutation.mutate({ ...payload, type: "AUTRE" })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/formulaires")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0 flex-1"
          placeholder="Nom du formulaire"
        />
        <Badge variant="outline">{questions.length} question{questions.length !== 1 ? "s" : ""}</Badge>
        <Button onClick={save} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: question types */}
        <div className="w-48 shrink-0">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">
            Ajouter
          </p>
          <div className="space-y-1">
            {QUESTION_TYPES.map(({ type, emoji }) => (
              <button
                key={type}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-bg-secondary transition-colors"
                onClick={() => addQuestion(type)}
              >
                <span>{emoji}</span>
                <span>{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: question list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">
            Questions
          </p>
          {questions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-card border-2 border-dashed border-border text-text-tertiary gap-2">
              <Plus className="h-8 w-8" />
              <p className="text-sm">Cliquez sur un type de question pour commencer</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 pr-3">
                    {questions.map((q) => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        isSelected={selectedId === q.id}
                        onClick={() => setSelectedId(q.id)}
                        onDelete={() => deleteQuestion(q.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          )}
        </div>

        {/* Right: properties */}
        <div className="w-64 shrink-0 border border-border rounded-card overflow-hidden bg-bg-primary">
          {selectedQuestion ? (
            <ScrollArea className="h-full">
              <PropertiesPanel
                question={selectedQuestion}
                allQuestions={questions}
                onChange={updateQuestion}
              />
            </ScrollArea>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-text-tertiary p-4 text-center">
              Sélectionnez une question pour modifier ses propriétés
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
