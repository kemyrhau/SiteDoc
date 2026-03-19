import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

/**
 * Registrer et opplastet bilde i server-databasen (images-tabellen).
 * Kalles etter vellykket filopplasting til S3/R2.
 * Bruker direkte HTTP-kall til tRPC (ikke hooks) siden dette
 * kjøres fra OpplastingsKoProvider utenfor React-treet.
 */
export async function registrerBildeIDatabase(params: {
  sjekklisteId?: string | null;
  oppgaveId?: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAktivert?: boolean;
}): Promise<void> {
  const token = await hentSessionToken();
  if (!token) {
    console.warn("[BILDE-REG] Ingen sesjonstoken — hopper over registrering");
    return;
  }

  const baseUrl = AUTH_CONFIG.apiUrl;

  // Bygg tRPC mutation-kall avhengig av type
  let prosedyre: string;
  let input: Record<string, unknown>;

  if (params.oppgaveId) {
    prosedyre = "bilde.opprettForOppgave";
    input = {
      taskId: params.oppgaveId,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      gpsLat: params.gpsLat ?? undefined,
      gpsLng: params.gpsLng ?? undefined,
      gpsEnabled: params.gpsAktivert ?? true,
    };
  } else if (params.sjekklisteId) {
    prosedyre = "bilde.opprettForSjekkliste";
    input = {
      checklistId: params.sjekklisteId,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      gpsLat: params.gpsLat ?? undefined,
      gpsLng: params.gpsLng ?? undefined,
      gpsEnabled: params.gpsAktivert ?? true,
    };
  } else {
    console.warn("[BILDE-REG] Verken sjekklisteId eller oppgaveId — hopper over");
    return;
  }

  // Fjern undefined-verdier (tRPC godtar ikke explicit undefined)
  const rensetInput: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) rensetInput[k] = v;
  }

  try {
    // tRPC mutation via HTTP: POST /trpc/{prosedyre} med JSON body
    const url = `${baseUrl}/trpc/${prosedyre}`;
    console.log("[BILDE-REG] URL:", url);
    console.log("[BILDE-REG] Input:", JSON.stringify(rensetInput));
    const respons = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rensetInput),
    });

    if (!respons.ok) {
      const feilTekst = await respons.text().catch(() => "Ukjent feil");
      console.error("[BILDE-REG] Feilet:", respons.status, feilTekst);
      console.error("[BILDE-REG] URL var:", url);
      console.error("[BILDE-REG] Body var:", JSON.stringify(rensetInput));
      return;
    }

    console.log("[BILDE-REG] Registrert:", params.fileName, "→", prosedyre);
  } catch (feil) {
    // Ikke-kritisk — bildet er allerede opplastet til S3/R2
    console.warn("[BILDE-REG] Nettverksfeil:", feil instanceof Error ? feil.message : feil);
  }
}
