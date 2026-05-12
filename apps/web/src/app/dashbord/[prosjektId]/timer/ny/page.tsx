import { redirect } from "next/navigation";

/**
 * T7-1b (2026-05-12): URL-flytt fra prosjekt-bundet sti til firma-kontekst.
 * «Ny dagsseddel» starter ikke lenger fra et bestemt prosjekt — bruker
 * velger prosjekt via geo-forslag eller manuell velger i ny flyt.
 * Beholdes som redirect-stub for eldre bokmerker og lenker.
 */
export default function Page() {
  redirect("/dashbord/timer/ny");
}
