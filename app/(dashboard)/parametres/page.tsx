"use client"

import { useSearchParams } from "next/navigation"
import { Topbar } from "@/components/dashboard/topbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CliniquTab } from "@/components/parametres/clinique-tab"
import { FacturationTab } from "@/components/parametres/facturation-tab"
import { IntegrationsTab } from "@/components/parametres/integrations-tab"
import { ConformiteTab } from "@/components/parametres/conformite-tab"
import { EquipeTab } from "@/components/parametres/equipe-tab"
import { ServicesTab } from "@/components/parametres/services-tab"

export default function ParametresPage() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") ?? "clinique"

  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Paramètres" />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="clinique">Clinique</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
          <TabsTrigger value="facturation">Facturation</TabsTrigger>
          <TabsTrigger value="conformite">Conformité Loi 25</TabsTrigger>
          <TabsTrigger value="services">Services & Tarifs</TabsTrigger>
          <TabsTrigger value="equipe">Équipe</TabsTrigger>
        </TabsList>

        <TabsContent value="clinique">
          <CliniquTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="facturation">
          <FacturationTab />
        </TabsContent>
        <TabsContent value="conformite">
          <ConformiteTab />
        </TabsContent>
        <TabsContent value="services">
          <ServicesTab />
        </TabsContent>
        <TabsContent value="equipe">
          <EquipeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
