import { redirect } from "next/navigation";

// K9-opprydding: legacy → kanonisk /dashbord/[prosjektId]/sjekklister/[sjekklisteId].
export default function LegacySjekkliste({ params }: { params: { id: string; sjekklisteId: string } }) {
  redirect(`/dashbord/${params.id}/sjekklister/${params.sjekklisteId}`);
}
