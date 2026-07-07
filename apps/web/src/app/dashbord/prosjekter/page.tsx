import { redirect } from "next/navigation";

// K9-opprydding (redesign/navigasjon): legacy prosjektliste → kanonisk dashbord.
// Redirect beholdes til redesignet er ferdig utrullet (nettleser-bokmerker lever
// lenger enn 1-ukes mobil-API-regelen).
export default function LegacyProsjekterListe() {
  redirect("/dashbord");
}
