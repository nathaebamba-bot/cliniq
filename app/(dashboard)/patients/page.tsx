import { Topbar } from "@/components/dashboard/topbar"
import { PatientsList } from "@/components/patients/patients-list"

export const metadata = { title: "Patients" }

export default function PatientsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Topbar title="Patients" />
      <PatientsList />
    </div>
  )
}
