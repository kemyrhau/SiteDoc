import { redirect } from "next/navigation";

/**
 * T7-1b (2026-05-12): URL-flytt fra prosjekt-bundet sti til firma-kontekst.
 * Sedler kan spenne flere prosjekter — URL er ikke lenger meningsfull med
 * `[prosjektId]`. Beholdes som redirect-stub for eldre bokmerker og lenker.
 */
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/dashbord/timer/${params.id}`);
}
