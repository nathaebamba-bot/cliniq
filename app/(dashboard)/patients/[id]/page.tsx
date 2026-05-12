import { Topbar } from "@/components/dashboard/topbar"
import { PatientDetail } from "@/components/patients/patient-detail"

export const metadata = { title: "Dossier patient" }

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Dossier patient" />
      <PatientDetail patientId={id} />
    </div>
  )
}
