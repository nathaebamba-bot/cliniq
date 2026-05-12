"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TYPE_LABELS } from "@/types/formulaire"
import type { Question } from "@/types/formulaire"
import { cn } from "@/lib/utils"

interface Props {
  question: Question
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function QuestionCard({ question, isSelected, onClick, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 bg-bg-primary cursor-pointer transition-all",
        isSelected ? "border-brand-primary ring-1 ring-brand-primary" : "border-border hover:border-brand-primary/40",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
      onClick={onClick}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-text-tertiary hover:text-text-secondary cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs shrink-0">
            {TYPE_LABELS[question.type]}
          </Badge>
          {question.obligatoire && (
            <Badge className="text-xs bg-red-50 text-red-600 border-0 shrink-0">Requis</Badge>
          )}
        </div>
        <p className={cn("mt-1 text-sm leading-snug truncate", question.type === "section" ? "font-semibold text-base" : "")}>
          {question.question || <span className="text-text-tertiary italic">Question sans titre</span>}
        </p>
        {question.condition && (
          <p className="text-xs text-text-tertiary mt-0.5">
            Conditionnelle
          </p>
        )}
      </div>

      {/* Delete button */}
      <button
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-all p-1 rounded"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
