import { redirect } from "next/navigation";

// K9-opprydding: legacy → kanonisk /dashbord/[prosjektId]/maler/[malId].
export default function LegacyMal({ params }: { params: { id: string; malId: string } }) {
  redirect(`/dashbord/${params.id}/maler/${params.malId}`);
}
