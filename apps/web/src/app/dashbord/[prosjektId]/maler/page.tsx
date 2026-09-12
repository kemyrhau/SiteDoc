import { redirect } from "next/navigation";

// Rapportmaler-flata fjernet (vei b, fabel-endringsordre 2026-09-12): den blandet
// sjekkliste/oppgave/HMS i én liste uten fagområde/prefiks/versjon, og gjorde ingenting
// Oppsett › Produksjon ikke gjør bedre. Server-redirect så bokmerker/dyplenker flyttes
// (ikke 404). Malforvaltning bor nå kun på Oppsett › Produksjon.
export default function MalerFlyttet() {
  redirect("/dashbord/oppsett/produksjon/sjekklistemaler");
}
