"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, X, Send, User, Bot, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Qui n'a pas confirmé aujourd'hui?",
  "Mes stats de la semaine?",
  "RDV des 3 prochains jours",
  "Rédige un SMS de relance pour un no-show",
]

export function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  useEffect(() => {
    if (open && messages.length === 0) {
      textareaRef.current?.focus()
    }
  }, [open, messages.length])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const newMessages: Message[] = [...messages, { role: "user", content }]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json() as { content?: string; error?: string }
      setMessages([...newMessages, {
        role: "assistant",
        content: data.content ?? data.error ?? "Désolé, une erreur est survenue.",
      }])
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "Erreur de connexion. Réessayez dans un instant.",
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          open
            ? "bg-bg-primary border-2 border-border text-text-secondary rotate-0"
            : "bg-brand-primary text-white hover:bg-brand-secondary scale-100 hover:scale-105"
        )}
        title="Assistant IA"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[600px] flex flex-col rounded-2xl border border-border bg-bg-primary shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-brand-primary">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Assistant Cliniq</p>
              <p className="text-xs text-white/70">IA · Données en temps réel</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-brand-primary" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-bg-secondary px-3.5 py-2.5 text-sm text-text-primary max-w-[85%]">
                    Bonjour! Je suis votre assistant IA. Posez-moi n'importe quelle question sur vos patients, rendez-vous ou statistiques.
                  </div>
                </div>
                <div className="pl-9 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-start gap-2.5", m.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                  m.role === "user"
                    ? "bg-brand-primary text-white"
                    : "bg-brand-primary/10"
                )}>
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-4 w-4 text-brand-primary" />}
                </div>
                <div className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed",
                  m.role === "user"
                    ? "bg-brand-primary text-white rounded-tr-sm"
                    : "bg-bg-secondary text-text-primary rounded-tl-sm"
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-brand-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-bg-secondary px-4 py-3">
                  <Loader2 className="h-4 w-4 text-text-tertiary animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 bg-bg-primary">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Posez une question… (Entrée pour envoyer)"
                rows={1}
                className="resize-none text-sm min-h-[40px] max-h-[120px] flex-1 rounded-xl border-border bg-bg-secondary focus-visible:ring-1 focus-visible:ring-brand-primary"
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl bg-brand-primary hover:bg-brand-secondary shrink-0"
                disabled={!input.trim() || loading}
                onClick={() => void send()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-text-tertiary mt-1.5 text-center">Maj+Entrée pour nouvelle ligne</p>
          </div>
        </div>
      )}
    </>
  )
}
