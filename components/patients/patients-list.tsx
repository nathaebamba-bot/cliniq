"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, UserX, UserCheck, MoreHorizontal, Upload, Download } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { trpc } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PatientForm } from "./patient-form"
import { StatutBadge } from "./statut-badge"
import { ImportCSVDialog } from "./import-csv-dialog"

export function PatientsList() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState("")
  const [filtrActif, setFiltrActif] = useState<boolean | undefined>(true)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const { data, isLoading } = trpc.patient.liste.useQuery({
    page,
    recherche: recherche || undefined,
    actif: filtrActif,
  })

  const archiverMutation = trpc.patient.archiver.useMutation({
    onSuccess: (_, vars) => {
      utils.patient.liste.invalidate()
      toast.success(vars.actif ? "Patient réactivé." : "Patient archivé.")
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSearch = useCallback((v: string) => {
    setRecherche(v)
    setPage(1)
  }, [])

  const patients = data?.patients ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              className="pl-9"
              placeholder="Rechercher par nom, téléphone ou courriel…"
              value={recherche}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Select
            value={filtrActif === undefined ? "tous" : filtrActif ? "actif" : "inactif"}
            onValueChange={(v) => {
              setFiltrActif(v === "tous" ? undefined : v === "actif")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actif">Actifs</SelectItem>
              <SelectItem value="inactif">Inactifs</SelectItem>
              <SelectItem value="tous">Tous</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.location.href = "/api/export/patients"}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer CSV
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau patient
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-card border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-bg-secondary">
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Dernier RDV</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Consentements</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-tertiary py-12">
                    Aucun patient trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-bg-secondary transition-colors"
                    onClick={() => router.push(`/patients/${p.id}`)}
                  >
                    <TableCell className="font-medium">
                      {p.nom}, {p.prenom}
                      {p.alertes && (
                        <Badge className="ml-2 bg-red-100 text-red-700 border-0 text-xs">
                          ⚠ Alerte
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.telephone}</TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {p.rendezvous[0] ? (
                        <div className="flex items-center gap-2">
                          <span>{format(new Date(p.rendezvous[0].dateHeure), "d MMM yyyy", { locale: fr })}</span>
                          <StatutBadge statut={p.rendezvous[0].statut} />
                        </div>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={p.actif ? "bg-green-100 text-green-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
                        {p.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.langue}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      <div className="flex gap-1">
                        {p.consentementSMS && <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">SMS</Badge>}
                        {p.consentementCourriel && <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Courriel</Badge>}
                        {!p.consentementSMS && !p.consentementCourriel && (
                          <span className="text-text-tertiary">Aucun</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-text-secondary hover:bg-bg-secondary transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/patients/${p.id}`)}>
                            Voir le profil
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={p.actif ? "text-red-600" : "text-green-600"}
                            onClick={() => archiverMutation.mutate({ id: p.id, actif: !p.actif })}
                          >
                            {p.actif ? (
                              <><UserX className="h-4 w-4 mr-2" />Archiver</>
                            ) : (
                              <><UserCheck className="h-4 w-4 mr-2" />Réactiver</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>{total} patient{total !== 1 ? "s" : ""} au total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <span className="px-2">Page {page} / {pages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {/* Import CSV dialog */}
      <ImportCSVDialog
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={() => { setShowImport(false); utils.patient.liste.invalidate() }}
      />

      {/* New patient dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau patient</DialogTitle>
          </DialogHeader>
          <PatientForm onSuccess={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
