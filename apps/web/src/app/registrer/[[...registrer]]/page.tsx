import { redirect } from "next/navigation";

// Auth.js bruker OAuth-providere — ingen separat registreringsside
export default function RegistrerSide() {
  redirect("/logg-inn");
}
