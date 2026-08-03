"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";

/**
 * Unifisert opprett-velger (Funn C, 2026-08-03) — ÉN interaksjonskilde for sjekkliste + oppgave.
 * Fabel-spec: `docs/claude/delplaner/funn-c-opprett-velger-interaksjons-spec.md`.
 *
 * Åpne-regelen (0 → knapp av, 1 → auto-hopp, >1 → alltid velger) eies av KALLEREN (`åpneMalVelger`).
 * Denne komponenten eier bare selve velger-interaksjonen når den er åpen: markør (init = sist-brukt,
 * ellers første rad), ↑/↓ (ingen wrap, flatt over gruppegrenser), Enter/«Opprett» oppretter, klikk på
 * rad = velg+bekreft i ett. Grupper-overskrifter er ikke-fokuserbare (markøren hopper flatt forbi).
 * `onVelg` per rad abstraherer forskjellen: sjekkliste-rad = løst kandidat (opprett direkte); oppgave-
 * rad = mal (auto-bind ELLER åpne steg-2 flyt-velger — kallerens ansvar).
 */

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

export interface VelgerGruppe {
  key: string;
  /** Valgfri gruppe-overskrift (sjekklistens flyt-gruppering). Oppgave = flat, ingen overskrift. */
  overskrift?: { navn: string; undertekst?: string };
  maler: VelgerMalRad[];
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

  // Flat sekvens av valgbare rader — markøren indekserer disse (headere hoppes flatt over).
  const flate = useMemo(() => grupper.flatMap((g) => g.maler), [grupper]);

  // Init-markør: første rad med sist-brukte mal-id, ellers 0 (spec § 1).
  const initIndex = useMemo(() => {
    const i = flate.findIndex((r) => r.malId === sistBruktMalId);
    return i >= 0 ? i : 0;
  }, [flate, sistBruktMalId]);

  const [markør, setMarkør] = useState(initIndex);
  // Gjenåpning / ny liste → markør tilbake til sist-brukt.
  useEffect(() => setMarkør(initIndex), [initIndex]);

  // Fokus lista ved åpning (spec § 2: ↑/↓/Enter virker umiddelbart uten ekstra tab).
  useEffect(() => {
    listeRef.current?.focus();
  }, []);

  // Hold markert rad synlig (også ved init-scroll til sist-brukt i lang liste).
  // Optional-kall: scrollIntoView finnes ikke i jsdom (test-miljø) — trygt no-op der.
  useEffect(() => {
    radRefs.current[markør]?.scrollIntoView?.({ block: "nearest" });
  }, [markør]);

  const velgMarkør = () => flate[markør]?.onVelg();

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkør((i) => Math.min(i + 1, flate.length - 1)); // ingen wrap (spec § 2)
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkør((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      velgMarkør();
    }
    // Esc håndteres av Modal-en (lukk uten opprettelse, spec § 2/§ 5).
  }

  // Løpende flat-indeks for hver rad (markør-sammenligning på tvers av grupper).
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
        {grupper.map((g) => (
          <div key={g.key} className="space-y-0.5">
            {g.overskrift && (
              <div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {g.overskrift.navn}
                {g.overskrift.undertekst && (
                  <span className="ml-1 font-normal normal-case text-gray-400">· {g.overskrift.undertekst}</span>
                )}
              </div>
            )}
            {g.maler.map((rad) => {
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
                  onMouseEnter={() => { /* hover flytter IKKE markøren (spec § 1) */ }}
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
