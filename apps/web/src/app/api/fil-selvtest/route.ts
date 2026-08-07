import { NextResponse } from "next/server";
import { signerFilSti, verifiserFilSignatur } from "@sitedoc/api/src/utils/hmac";

// Kjøres i node-runtime (crypto). Signering skjer i web-prosessen — derfor
// hører røyktesten hjemme her.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signerings-røyktest (S1, deploy-verifisering). Web signerer en sentinel-URL og
 * verifiserer den selv → fanger manglende/ødelagt `FIL_SIGNING_SECRET` i
 * web-prosessen på sekunder, ikke ved at en feltarbeider oppdager det.
 *
 * `url` returneres for en valgfri KRYSS-prosess-sjekk: GET `/api${url}` (web →
 * rewrite → api-hook). Gyldig signatur → 404 (sentinel-fila finnes ikke, men
 * hooken slapp den gjennom) = api+web enige om secret. 401 = mismatch/manglende
 * secret i api. Sentinelen peker på en ikke-eksisterende fil → ufarlig å eksponere.
 */
export async function GET() {
  try {
    const signert = signerFilSti("/uploads/privat/__selvtest__");
    const u = new URL(signert, "http://x");
    const ok = verifiserFilSignatur(
      u.pathname,
      u.searchParams.get("exp"),
      u.searchParams.get("sig"),
    );
    return NextResponse.json({ ok, url: signert }, { status: ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
