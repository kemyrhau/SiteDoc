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
): Promise<OpplastingsResultat> {
  const token = await hentSessionToken();

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: filnavn,
    type: mimeType,
  } as unknown as Blob);

  const respons = await fetch(`${AUTH_CONFIG.apiUrl}/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!respons.ok) {
    const feil = await respons.json().catch(() => ({ error: "Opplasting feilet" }));
    throw new Error(feil.error ?? "Opplasting feilet");
  }

  return respons.json();
}
