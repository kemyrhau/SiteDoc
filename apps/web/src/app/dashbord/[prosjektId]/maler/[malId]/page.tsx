import { redirect } from "next/navigation";

// Rapportmaler-flata fjernet (vei b, fabel-endringsordre 2026-09-12). Detaljruten
// åpnet tidligere MalBygger på prosjektnivå — en andre inngang til byggeren. Redigering
// bor nå kun på Oppsett › Produksjon. Server-redirect så gamle dyplenker flyttes (ikke 404).
export default function MalDetaljFlyttet() {
  redirect("/dashbord/oppsett/produksjon/sjekklistemaler");
}
