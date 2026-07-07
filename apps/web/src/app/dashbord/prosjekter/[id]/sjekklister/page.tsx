import { redirect } from "next/navigation";

// K9-opprydding: legacy → kanonisk /dashbord/[prosjektId]/sjekklister.
export default function LegacySjekklister({ params }: { params: { id: string } }) {
  redirect(`/dashbord/${params.id}/sjekklister`);
}
