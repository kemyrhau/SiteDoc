import { redirect } from "next/navigation";

// K9-opprydding: legacy prosjekt-oversikt → kanonisk /dashbord/[prosjektId].
export default function LegacyProsjektOversikt({ params }: { params: { id: string } }) {
  redirect(`/dashbord/${params.id}`);
}
