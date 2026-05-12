"use client"

import { useRef, useState } from "react"
import Papa from "papaparse"
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/trpc/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Row {
  prenom: string
  nom: string
  telephone: string
  courriel?: string
  dateNaissance?: string
  langue?: string
  consentementSMS?: string
  consentementCourriel?: string
  notes?: string
}

function normaliser(row: Row) {
  return {
    prenom: (row.prenom ?? "").trim(),
    nom: (row.nom ?? "").trim(),
    telephone: (row.telephone ?? "").trim(),
    courriel: (row.courriel ?? "").trim() || null,
    dateNaissance: (row.dateNaissance ?? "").trim() || null,
    langue: (row.langue ?? "FR").toUpperCase() === "EN" ? "EN" as const : "FR" as const,
    consentementSMS: ["1", "true", "oui", "yes"].includes((row.consentementSMS ?? "").toLowerCase()),
    consentementCourriel: ["1", "true", "oui", "yes"].includes((row.consentementCourriel ?? "").toLowerCase()),
    notes: (row.notes ?? "").trim() || null,
  }
}

function estValide(row: ReturnType<typeof normaliser>) {
  return row.prenom.length > 0 && row.nom.length > 0 && row.telephone.length > 0
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportCSVDialog({ open, onOpenChange, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ReturnType<typeof normaliser>[]>([])
  const [erreurs, setErreurs] = useState(0)
  const utils = trpc.useUtils()

  const importMutation = trpc.patient.importerCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.importe} patient(s) importé(s) avec succès.`)
      utils.patient.liste.invalidate()
      onSuccess()
      reset()
    },
    onError: (e) => toast.error(e.message),
  })

  function reset() {
    setRows([])
    setErreurs(0)
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleFile(file: File) {
    // Map French export headers → camelCase keys the normaliser expects
    const HEADER_MAP: Record<string, string> = {
      "Prenom": "prenom",
      "Nom": "nom",
      "Date naissance": "dateNaissance",
      "Sexe": "sexe",
      "Telephone": "telephone",
      "Courriel": "courriel",
      "Langue": "langue",
      "Consentement SMS": "consentementSMS",
      "Consentement courriel": "consentementCourriel",
      "Notes": "notes",
      "Cree le": "creeLe",
    }

    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => HEADER_MAP[h.trim()] ?? h.trim().toLowerCase().replace(/\s+/g, ""),
      complete: (result) => {
        const normalises = result.data.map(normaliser)
        const valides = normalises.filter(estValide)
        setRows(valides)
        setErreurs(normalises.length - valides.length)
      },
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith(".csv")) handleFile(file)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des patients depuis un CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format info */}
          <div className="rounded-lg bg-bg-secondary border border-border p-3 text-xs text-text-secondary font-mono">
            En-têtes attendus: <span className="text-text-primary">prenom, nom, telephone</span> (obligatoires) +
            courriel, dateNaissance, langue (FR/EN), consentementSMS, consentementCourriel, notes
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-brand-primary/50 hover:bg-bg-secondary transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">Glissez un fichier CSV ici</p>
            <p className="text-xs text-text-tertiary mt-1">ou cliquez pour choisir</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {/* Results */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-700 border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {rows.length} patient(s) valides
                </Badge>
                {erreurs > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-0">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {erreurs} ligne(s) ignorées (données manquantes)
                  </Badge>
                )}
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="text-left p-2 font-medium text-text-secondary">Nom</th>
                      <th className="text-left p-2 font-medium text-text-secondary">Téléphone</th>
                      <th className="text-left p-2 font-medium text-text-secondary">Courriel</th>
                      <th className="text-left p-2 font-medium text-text-secondary">Langue</th>
                      <th className="text-left p-2 font-medium text-text-secondary">Consents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{r.nom}, {r.prenom}</td>
                        <td className="p-2 font-mono">{r.telephone}</td>
                        <td className="p-2 text-text-secondary">{r.courriel ?? "—"}</td>
                        <td className="p-2">{r.langue}</td>
                        <td className="p-2">
                          {r.consentementSMS && <Badge className="bg-blue-50 text-blue-600 border-0 mr-1 text-xs">SMS</Badge>}
                          {r.consentementCourriel && <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Courriel</Badge>}
                          {!r.consentementSMS && !r.consentementCourriel && <span className="text-text-tertiary">—</span>}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 5 && (
                      <tr className="border-t border-border">
                        <td colSpan={5} className="p-2 text-center text-text-tertiary">
                          … et {rows.length - 5} autre(s)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>
            Annuler
          </Button>
          <Button
            disabled={rows.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate({ patients: rows })}
          >
            {importMutation.isPending ? "Import en cours…" : `Importer ${rows.length} patient(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
