import { redirect } from "next/navigation";

/**
 * Onboarding-innholdet er flyttet til timer-hjem (`../page.tsx`, struktur a).
 * Denne ruta beholdes kun for gamle lenker/bokmerker og redirecter dit.
 * Redirecten er UT av nav-flaten — ingen ⇄ eller nav-element peker hit lenger
 * (fane/hub-kort/hub-ruter er alle pekt om til /dashbord/firma/timer), så
 * kryss-kontekst-render-avbruddet (React #310) kan ikke gjenoppstå her.
 */
export default function TimerOnboardingRedirect() {
  redirect("/dashbord/firma/timer");
}
