"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";

/**
 * Unifisert opprett-velger (Funn C, 2026-08-03; gruppering v2, 2026-08-04) — ÉN interaksjonskilde
 * for sjekkliste + oppgave. Fabel-spec: `funn-c-opprett-velger-interaksjons-spec.md` +
 * `velger-gruppering-v2-visuell-spec.md`.
 *
 * Åpne-regelen (0 → knapp av; ≥1 → alltid velger — auto-hopp fjernet, Ordre 1.4) eies av KALLEREN (`åpneMalVelger`).
 * Denne komponenten eier velger-interaksjonen når den er åpen: markør (init = sist-brukt, ellers
 * første rad), ↑/↓ (ingen wrap, flatt over ALLE gruppegrenser), Enter/«Opprett» oppretter, klikk på
 * rad = velg+bekreft i ett. Overskrifter (begge nivåer) er ikke-fokuserbare (markøren hopper flatt forbi).
 *
 * Gruppering (v2): tre nivåer — faggruppe-seksjon (nivå 1, VERSALER) → dokumentflyt-undergruppe
 * (nivå 2) → mal-rad (nivå 3). All sortering skjer HER (paritet begge flater): faggruppe-seksjoner
 * alfabetisk (unntatt `sorterSist` — HMS pinnes nederst), flyt-undergrupper alfabetisk, mal-rader på
 * prefiks (naturlig/numerisk, uten prefiks nederst). Sist-brukt påvirker ALDRI rekkefølgen — kun
 * markørens startrad + etikett.
 */

const NB = "nb-NO";

/** Faggruppe/flyt-navn alfabetisk (case-insensitiv, norsk collation). */
function sammenlignNavn(a?: string, b?: string): number {
  return (a ?? "").localeCompare(b ?? "", NB, { sensitivity: "base" });
}

/** Mal-rader på prefiks (naturlig/numerisk: «KB2-010» < «KB2-100»); uten prefiks nederst, alfabetisk. */
function sammenlignMal(a: VelgerMalRad, b: VelgerMalRad): number {
  const ap = a.prefix?.trim() ?? "";
  const bp = b.prefix?.trim() ?? "";
  if (ap && !bp) return -1;
  if (!ap && bp) return 1;
  if (ap && bp) {
    const c = ap.localeCompare(bp, NB, { numeric: true, sensitivity: "base" });
    if (c !== 0) return c;
  }
  return a.malNavn.localeCompare(b.malNavn, NB, { numeric: true, sensitivity: "base" });
}

export interface VelgerMalRad {
  /** Unik rad-nøkkel (mal+flyt for grupperte lister). */
  radKey: string;
  /** Mal-id — styrer «Sist brukt»-etikett + init-markør (følger MALEN, ikke raden). */
  malId: string;
  malNavn: string;
  prefix?: string | null;
  /** Velg + bekreft i ett: opprett direkte, eller åpne steg-2 (kallerens valg). */
  onVelg: () => void;
}

/** Nivå 2 — dokumentflyt-undergruppe. `overskrift` utelates når nivået ikke finnes (HMS: flyt-løs). */
export interface VelgerFlytUndergruppe {
  key: string;
  overskrift?: { navn: string };
  maler: VelgerMalRad[];
}

/** Nivå 1 — faggruppe-seksjon (VERSALER). `sorterSist` pinner seksjonen nederst (HMS-seksjonen). */
export interface VelgerGruppe {
  key: string;
  overskrift?: { navn: string };
  /** Sortér denne seksjonen etter de alfabetiske faggruppe-seksjonene (HMS auto-rute-maler). */
  sorterSist?: boolean;
  undergrupper: VelgerFlytUndergruppe[];
}

export function OpprettMalVelger({
  grupper,
  sistBruktMalId,
  opprettPending,
  footer,
}: {
  grupper: VelgerGruppe[];
  /** Sist-brukte mal (per prosjekt + dokumenttype) — init-markør + etikett. */
  sistBruktMalId: string | null;
  opprettPending: boolean;
  /** Dempet utilgjengelig-seksjon under lista (ikke-valgbar, egen render fra kalleren). */
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const listeRef = useRef<HTMLDivElement>(null);
  const radRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Nivå-1-seksjoner (init-scroll til sist-bruktes seksjon m/ begge overskrifter — spec § 7).
  const seksjonRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Deterministisk sortering (spec § 6) — HER, ikke i kalleren, så begge flater er identiske.
  const sorterteGrupper = useMemo(
    () =>
      [...grupper]
        .sort((a, b) => {
          // HMS-seksjonen (sorterSist) pinnes nederst; faggruppe-seksjoner alfabetisk.
          if (!!a.sorterSist !== !!b.sorterSist) return a.sorterSist ? 1 : -1;
          return sammenlignNavn(a.overskrift?.navn, b.overskrift?.navn);
        })
        .map((g) => ({
          ...g,
          undergrupper: [...g.undergrupper]
            .sort((x, y) => sammenlignNavn(x.overskrift?.navn, y.overskrift?.navn))
            .map((u) => ({ ...u, maler: [...u.maler].sort(sammenlignMal) })),
        })),
    [grupper],
  );

  // Flat sekvens av valgbare rader — markøren indekserer disse (headere hoppes flatt over).
  const flate = useMemo(
    () => sorterteGrupper.flatMap((g) => g.undergrupper.flatMap((u) => u.maler)),
    [sorterteGrupper],
  );

  // Init-markør: første rad med sist-brukte mal-id, ellers 0 (Funn C § 1).
  const initIndex = useMemo(() => {
    const i = flate.findIndex((r) => r.malId === sistBruktMalId);
    return i >= 0 ? i : 0;
  }, [flate, sistBruktMalId]);

  // Nivå-1-seksjon som inneholder sist-brukt (init-scroll-mål) — null hvis ingen sist-brukt-treff.
  const initSeksjonKey = useMemo(() => {
    if (flate.findIndex((r) => r.malId === sistBruktMalId) < 0) return null;
    for (const g of sorterteGrupper) {
      if (g.undergrupper.some((u) => u.maler.some((r) => r.malId === sistBruktMalId))) return g.key;
    }
    return null;
  }, [sorterteGrupper, flate, sistBruktMalId]);

  const [markør, setMarkør] = useState(initIndex);
  // Gjenåpning / ny liste → markør tilbake til sist-brukt.
  useEffect(() => setMarkør(initIndex), [initIndex]);

  // Fokus lista ved åpning (Funn C § 2: ↑/↓/Enter virker umiddelbart uten ekstra tab).
  useEffect(() => {
    listeRef.current?.focus();
  }, []);

  // Hold markert rad synlig ved ↑/↓-flytting.
  // Optional-kall: scrollIntoView finnes ikke i jsdom (test-miljø) — trygt no-op der.
  useEffect(() => {
    radRefs.current[markør]?.scrollIntoView?.({ block: "nearest" });
  }, [markør]);

  // Ved åpning: scroll sist-bruktes faggruppe-seksjon synlig INKLUDERT begge overskrifter (spec § 7).
  // Deklarert etter markør-scrollen → vinner ved mount; kjører kun én gang (tom deps).
  useEffect(() => {
    if (initSeksjonKey) seksjonRefs.current.get(initSeksjonKey)?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const velgMarkør = () => flate[markør]?.onVelg();

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkør((i) => Math.min(i + 1, flate.length - 1)); // ingen wrap (Funn C § 2)
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkør((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      velgMarkør();
    }
    // Esc håndteres av Modal-en (lukk uten opprettelse, Funn C § 2/§ 5).
  }

  // Løpende flat-indeks for hver rad (markør-sammenligning på tvers av alle grupper/nivåer).
  let løpende = -1;

  return (
    <div className="space-y-3">
      <div
        ref={listeRef}
        role="listbox"
        aria-label={t("sjekklister.velgMal")}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="space-y-1 outline-none"
      >
        {sorterteGrupper.map((g) => (
          <div
            key={g.key}
            ref={(el) => { seksjonRefs.current.set(g.key, el); }}
            className="space-y-0.5 pt-3 first:pt-0"
          >
            {/* Nivå 1 — faggruppe-seksjon: VERSALER, ingen innrykk, luft-skilt (spec § 2). */}
            {g.overskrift && (
              <div className="px-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {g.overskrift.navn}
              </div>
            )}
            {g.undergrupper.map((u) => (
              <div key={u.key} className="space-y-0.5">
                {/* Nivå 2 — dokumentflyt-undergruppe: normal case, lett innrykk, svakere vekt (spec § 3). */}
                {u.overskrift && (
                  <div className="px-1 pl-2 pt-0.5 text-[13px] font-medium text-gray-400">
                    {u.overskrift.navn}
                  </div>
                )}
                {u.maler.map((rad) => {
                  løpende += 1;
                  const idx = løpende;
                  const erMarkert = idx === markør;
                  const erSistBrukt = rad.malId === sistBruktMalId;
                  return (
                    <div
                      key={rad.radKey}
                      ref={(el) => { radRefs.current[idx] = el; }}
                      role="option"
                      aria-selected={erMarkert}
                      data-testid={`opprettvelger-rad-${rad.malId}`}
                      onClick={() => { setMarkør(idx); rad.onVelg(); }}
                      onMouseEnter={() => { /* hover flytter IKKE markøren (Funn C § 1) */ }}
                      className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                        erMarkert ? "border-l-2 border-sitedoc-primary bg-sitedoc-primary/5" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-800">{rad.malNavn}</span>
                      {rad.prefix && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{rad.prefix}</span>
                      )}
                      {erSistBrukt && (
                        <span className="ml-auto text-xs text-gray-400">{t("opprettVelger.sistBrukt")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {footer}

      <div className="flex pt-1">
        <Button
          data-testid="opprettvelger-opprett"
          loading={opprettPending}
          disabled={flate.length === 0}
          onClick={velgMarkør}
        >
          {t("handling.opprett")}
        </Button>
      </div>
    </div>
  );
}
