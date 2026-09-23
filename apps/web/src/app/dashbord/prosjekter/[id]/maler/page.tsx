import { redirect } from "next/navigation";

// Legacy → Oppsett › Produksjon. Rapportmaler-flata (`[prosjektId]/maler`) er fjernet
// (vei b, 2026-09-12); denne peker rett til den nye destinasjonen, ikke til noe borte.
export default function LegacyMaler() {
  redirect("/dashbord/oppsett/produksjon/sjekklistemaler");
}
