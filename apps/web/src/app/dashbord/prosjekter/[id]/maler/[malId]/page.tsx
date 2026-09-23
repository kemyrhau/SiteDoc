import { redirect } from "next/navigation";

// Legacy → Oppsett › Produksjon. Detaljruten (`[prosjektId]/maler/[malId]`) er fjernet
// (vei b, 2026-09-12); denne peker rett til den nye destinasjonen, ikke til noe borte.
export default function LegacyMal() {
  redirect("/dashbord/oppsett/produksjon/sjekklistemaler");
}
