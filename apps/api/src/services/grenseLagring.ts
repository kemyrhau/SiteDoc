/**
 * Grenseresolver trinn 3 del B — server-frys av kravsnapshot ved lagring.
 *
 * 🔴 Landminen: `grenseSnapshot` lagres SIDESTILT med `verdi` i feltobjektet, ALDRI inni.
 * `harFeltVerdi` (feltLaasing.ts) tester `verdi` direkte — et snapshot inni ville gjort et tomt
 * målefelt «besvart» og truffet seksjonstelleren, påkrevd-vakten og append-only-vakten samtidig.
 *
 * **Hvorfor server, ikke klient (målt):** både web og mobil lagrer via `oppdaterData` → én
 * implementasjon dekker begge, en gammel klient-bundel kan ikke skrive et utdatert snapshot, og
 * ingen init-whitelist på fire hooks trengs. Serveren finner `forelderVerdi` (Vei B) billig i
 * `data`-treet: rot er `Record<feltId, FeltVerdi>` (søsken-oppslag), repeater-rader er
 * `{ _radId, felter }` (søsken i samme rad). Klient-siden ville krevd seks berøringspunkter.
 *
 * **Frys ved MÅLETIDSPUNKT:** kun felt hvis verdi ENDRET seg i denne lagringen får nytt snapshot
 * (mot gjeldende mal). Uendrede felt beholder sitt eksisterende snapshot — så en mal-endring etter
 * målingen ikke omskriver kravet arkivet dokumenterer. Klienten stripper `grenseSnapshot` på tråden
 * (den kjenner det ikke), og serverens feltvise merge erstatter hele feltobjektet — derfor må
 * uendrede felt få snapshotet BÅRET FRAM fra `eksisterende` her, ellers går det tapt ved neste
 * lagring av et vilkårlig felt.
 */

import type { FeltVerdi } from "@sitedoc/pdf";
import { beregnGrenseSnapshot, TALL_TYPER } from "./arkiv/grensesnapshot";

interface ObjektMeta {
  type: string;
  config: Record<string, unknown>;
}

type Scope = Record<string, FeltVerdi>;

/** Radens felter uansett lagringsform: `{ _radId, felter }` (produksjon) eller naken `Record`. */
function radFelter(raa: unknown): Scope {
  if (raa && typeof raa === "object" && "felter" in raa) {
    return (raa as { felter: Scope }).felter;
  }
  return (raa ?? {}) as Scope;
}

function radId(raa: unknown): string | null {
  if (raa && typeof raa === "object" && "felter" in raa) {
    const id = (raa as { _radId?: unknown })._radId;
    return typeof id === "string" && id !== "" ? id : null;
  }
  return null;
}

function likVerdi(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Prosesser ett data-scope (rot eller én repeater-rads felter). Muterer `ny` in place.
 * `gammel` er samme scope fra lagret data (for endrings-deteksjon + fram-bæring), kan mangle.
 */
function prosesserScope(ny: Scope, gammel: Scope | undefined, objekter: Map<string, ObjektMeta>): void {
  for (const [id, felt] of Object.entries(ny)) {
    if (!felt || typeof felt !== "object") continue;
    const obj = objekter.get(id);
    if (!obj) continue;

    if (obj.type === "repeater") {
      // Muter rå rad-elementene in place (både produksjonsform og legacy) → treffer det som lagres.
      const nyeRader = Array.isArray(felt.verdi) ? (felt.verdi as unknown[]) : [];
      const gamleRader = Array.isArray(gammel?.[id]?.verdi) ? (gammel![id]!.verdi as unknown[]) : [];
      const gammelPerRadId = new Map<string, unknown>();
      gamleRader.forEach((r) => {
        const rid = radId(r);
        if (rid) gammelPerRadId.set(rid, r);
      });
      nyeRader.forEach((raa, idx) => {
        const rid = radId(raa);
        const gammelRaa = (rid && gammelPerRadId.get(rid)) ?? gamleRader[idx];
        prosesserScope(radFelter(raa), gammelRaa ? radFelter(gammelRaa) : undefined, objekter);
      });
      continue;
    }

    if (!TALL_TYPER.has(obj.type)) continue;

    const styrendeId = obj.config.styrendeFeltId;
    const forelderVerdi = typeof styrendeId === "string" ? ny[styrendeId]?.verdi : undefined;
    const snapshot = beregnGrenseSnapshot(obj.config, forelderVerdi, felt.verdi);
    if (!snapshot) continue; // ingen grense → intet snapshot

    const gammelFelt = gammel?.[id];
    const endret = !gammelFelt || !likVerdi(gammelFelt.verdi, felt.verdi);
    // Frys: uendret verdi med eksisterende snapshot beholder måletidspunktets krav.
    felt.grenseSnapshot = !endret && gammelFelt?.grenseSnapshot ? gammelFelt.grenseSnapshot : snapshot;
  }
}

/**
 * Skriv/frys kravsnapshot på alle tallfelt i `merget` (rot + repeater-rader, rekursivt).
 * `eksisterende` = lagret data før merge (for endrings-deteksjon + fram-bæring av frosne snapshot).
 * `objekter` = malens rapportobjekter (id → type + config). Muterer `merget` in place.
 */
export function frysGrenseSnapshots(
  merget: Record<string, unknown>,
  eksisterende: Record<string, unknown>,
  objekter: Array<{ id: string; type: string; config: unknown }>,
): void {
  const kart = new Map<string, ObjektMeta>(
    objekter.map((o) => [o.id, { type: o.type, config: (o.config ?? {}) as Record<string, unknown> }]),
  );
  // Har malen i det hele tatt et tallfelt med grense-relevans? Ellers hopp helt over.
  const harTallfelt = objekter.some((o) => TALL_TYPER.has(o.type));
  if (!harTallfelt) return;
  prosesserScope(merget as Scope, eksisterende as Scope, kart);
}
