import { redirect } from "next/navigation";

// K9-opprydding: legacy → kanonisk /dashbord/[prosjektId]/oppgaver.
export default function LegacyOppgaver({ params }: { params: { id: string } }) {
  redirect(`/dashbord/${params.id}/oppgaver`);
}
