import { redirect } from "next/navigation";

// Gammel adresse fra før «godkjenning» ble «attestering». w10b (§ 4.10 DK3): sendes rett til
// /dashbord/attestering, ikke via prosjektets (fjernede) side.
export default function GodkjenningRedirect() {
  redirect("/dashbord/attestering");
}
