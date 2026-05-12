"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Question } from "@/types/formulaire"

interface Props {
  question: Question
  allQuestions: Question[]
  onChange: (updated: Question) => void
}

export function PropertiesPanel({ question, allQuestions, onChange }: Props) {
  const [newOption, setNewOption] = useState("")

  const update = (patch: Partial<Question>) => onChange({ ...question, ...patch })

  const addOption = () => {
    if (!newOption.trim()) return
    update({ options: [...(question.options ?? []), newOption.trim()] })
    setNewOption("")
  }

  const removeOption = (index: number) => {
    update({ options: question.options?.filter((_, i) => i !== index) })
  }

  const hasOptions = question.type === "choix-multiple" || question.type === "cases-cocher"
  const hasScale = question.type === "echelle"
  const isSection = question.type === "section"

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
        Propriétés
      </h3>

      {/* Question text */}
      <div className="space-y-1">
        <Label>{isSection ? "Titre de la section" : "Question"}</Label>
        <Textarea
          rows={2}
          value={question.question}
          onChange={(e) => update({ question: e.target.value })}
          placeholder={isSection ? "Ex: Santé générale" : "Ex: Avez-vous des allergies ?"}
        />
      </div>

      {/* Description (section only) */}
      {isSection && (
        <div className="space-y-1">
          <Label>Sous-titre (optionnel)</Label>
          <Input
            value={question.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>
      )}

      {/* Required toggle */}
      {!isSection && (
        <div className="flex items-center justify-between">
          <Label className="font-normal">Réponse obligatoire</Label>
          <Switch
            checked={question.obligatoire}
            onCheckedChange={(v) => update({ obligatoire: v })}
          />
        </div>
      )}

      {/* Scale min/max */}
      {hasScale && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Minimum</Label>
            <Input
              type="number"
              value={question.min ?? 0}
              onChange={(e) => update({ min: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Maximum</Label>
            <Input
              type="number"
              value={question.max ?? 10}
              onChange={(e) => update({ max: parseInt(e.target.value) || 10 })}
            />
          </div>
        </div>
      )}

      {/* Options */}
      {hasOptions && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-1">
            {(question.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...(question.options ?? [])]
                    opts[i] = e.target.value
                    update({ options: opts })
                  }}
                  className="text-sm"
                />
                <button
                  onClick={() => removeOption(i)}
                  className="text-text-tertiary hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nouvelle option…"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
              className="text-sm"
            />
            <Button type="button" size="sm" variant="outline" onClick={addOption}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Condition */}
      {!isSection && allQuestions.filter((q) => q.id !== question.id && q.type === "oui-non").length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label className="text-xs text-text-tertiary uppercase tracking-wide">Condition d'affichage</Label>
          <Select
            value={question.condition?.questionId ?? "none"}
            onValueChange={(v) =>
              update({
                condition: v === "none" || !v ? undefined : { questionId: v, reponse: "oui" },
              })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Toujours visible" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Toujours visible</SelectItem>
              {allQuestions
                .filter((q) => q.id !== question.id && q.type === "oui-non")
                .map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    Si "{q.question.substring(0, 40)}…" = Oui
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {question.condition && (
            <Select
              value={question.condition.reponse}
              onValueChange={(v) => update({ condition: { ...question.condition!, reponse: v ?? "oui" } })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oui">Réponse = Oui</SelectItem>
                <SelectItem value="non">Réponse = Non</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}
