import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

export interface OpplastingsResultat {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export async function lastOppFil(
  uri: string,
  filnavn: string,
  mimeType: string,
  // Sensitive filer (timer-kvittering/utlegg) → uploads/privat/, serveres
  // signatur-KUN (S1 Fase 1).
  privat = false,
): Promise<OpplastingsResultat> {
  const token = await hentSessionToken();
  const url = `${AUTH_CONFIG.apiUrl}/upload${privat ? "?privat=1" : ""}`;

  console.log("[OPPL] Laster opp:", filnavn, "til:", url, "uri:", uri.slice(-50), "token:", token ? "ja" : "nei");

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: filnavn,
    type: mimeType,
  } as unknown as Blob);

  const respons = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  console.log("[OPPL] Respons status:", respons.status);

  if (!respons.ok) {
    const feil = await respons.json().catch(() => ({ error: "Opplasting feilet" }));
    console.error("[OPPL] Opplasting feilet:", respons.status, feil);
    throw new Error(feil.error ?? "Opplasting feilet");
  }

  const resultat = await respons.json();
  console.log("[OPPL] Suksess:", resultat.fileUrl);
  return resultat;
}
