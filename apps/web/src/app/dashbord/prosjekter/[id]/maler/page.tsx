import { redirect } from "next/navigation";

// K9-opprydding: legacy → kanonisk /dashbord/[prosjektId]/maler.
export default function LegacyMaler({ params }: { params: { id: string } }) {
  redirect(`/dashbord/${params.id}/maler`);
}
