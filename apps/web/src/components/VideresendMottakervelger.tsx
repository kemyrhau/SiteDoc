"use client";

// Videresend-mottakervelger (videresend synlig konsekvens, ramme 2+3, 2026-09-16).
//
// Erstatter de flate faggruppe-radene i split-▾ med en modal der KONSEKVENSEN vises i
// valgøyeblikket. To seksjoner:
//   «I denne flyten»  — flate personer i dokumentets EGEN flyt, ball-holder merket. Direkte
//                        valg (valgfri kommentar) — normal drift, ingen friksjon.
//   «Andre flyter»    — flyt-bytte-valg (kun når `kanByttFlyt`). Hvert valg fyrer et
//                        bekreftelsessteg med konsekvensboks + PÅKREVD kommentar; knappen
//                        navngir målflyten.
//
// Serveren (oppgave.ts/sjekkliste.ts `forwarded`) styrer selve mutasjonen: ved flyt-bytte
// auto-utledes mottaker (hovedansvarlig utfører i målflyten) og status røres ALDRI (F3.1).
// Komponenten er ren presentasjon — den kaller onVideresend med { mottaker, kommentar }.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { Modal } from "@sitedoc/ui";
import type { VideresendMedlem, VideresendValg } from "@/lib/videresend-valg";
import { mottakerNavnIValg } from "@/lib/videresend-valg";

interface VideresendMottaker {
  userId?: string;
  groupId?: string;
  dokumentflytId?: string;
}

interface VideresendMottakervelgerProps {
  åpen: boolean;
  onLukk: () => void;
  /** Dokumentets tittel (til modal-overskrift) — valgfri. */
  dokumentTittel?: string;
  /** Navnet på dokumentets egen flyt (konsekvensboksens «fra»-flyt). */
  egenFlytNavn?: string;
  /** Dokumentets egen flyt-ID — mottaker ved videresend innen egen flyt (ingen flyt-bytte). */
  aktivDokumentflytId?: string;
  /** Navnet på den som har ballen nå (til underoverskrift). */
  ballHolderNavn?: string | null;
  /** Flate personer i dokumentets EGEN flyt. */
  egenFlytMedlemmer: VideresendMedlem[];
  /** Nåværende mottaker — merker «har ballen» i egen-flyt-lista. */
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  /** Flyt-bytte-valg (allerede filtrert til ANDRE flyter enn dokumentets egen). */
  andreFlyter: VideresendValg[];
  /** Server-gaten (`kanByttFlyt` via hentTilgjengeligeFlyter): styrer om «Andre flyter» vises. */
  kanByttFlyt: boolean;
  erLaster?: boolean;
  onVideresend: (mottaker: VideresendMottaker, kommentar: string | undefined) => void;
}

export function VideresendMottakervelger({
  åpen,
  onLukk,
  dokumentTittel,
  egenFlytNavn,
  aktivDokumentflytId,
  ballHolderNavn,
  egenFlytMedlemmer,
  recipientUserId,
  recipientGroupId,
  andreFlyter,
  kanByttFlyt,
  erLaster,
  onVideresend,
}: VideresendMottakervelgerProps) {
  const { t } = useTranslation();
  // Rolle-etikett via statiske nøkler (ikke dynamiske) — holder i18n-nøkkelsett-testen grønn.
  const ROLLE_NOEKKEL: Record<string, string> = {
    utforer: "videresend.rolle.utforer",
    bestiller: "videresend.rolle.bestiller",
    godkjenner: "videresend.rolle.godkjenner",
    registrator: "videresend.rolle.registrator",
  };
  const rolleEtikett = (r: string) => (ROLLE_NOEKKEL[r] ? t(ROLLE_NOEKKEL[r]) : r);
  // Steg: velg (seksjoner) → bekreft (kun ved flyt-bytte).
  const [bekreftValg, setBekreftValg] = useState<VideresendValg | null>(null);
  // Valgt PERSON i «Andre flyter» (null = flyt-navn-klikk → serveren auto-utleder hovedansvarlig
  // utfører). Feil 1 (Kenneth 17.09): personradene var ikke valgbare, så flyt-bytte gikk ALLTID
  // til hovedansvarlig. Velger man en person, sendes dennes recipientUserId sammen med dokumentflytId.
  const [bekreftMedlem, setBekreftMedlem] = useState<VideresendMedlem | null>(null);
  const [kommentar, setKommentar] = useState("");
  // Hvilke «Andre flyter»-rader er ekspandert (informativt persontall).
  const [ekspandert, setEkspandert] = useState<Set<string>>(new Set());

  const lukkAlt = () => {
    setBekreftValg(null);
    setBekreftMedlem(null);
    setKommentar("");
    setEkspandert(new Set());
    onLukk();
  };

  // Åpne bekreftelsessteget for et flyt-bytte. `medlem` = valgt person (person-rad) eller null
  // (flyt-navn → serveren auto-utleder hovedansvarlig utfører).
  const åpneBekreft = (v: VideresendValg, medlem: VideresendMedlem | null) => {
    setKommentar("");
    setBekreftMedlem(medlem);
    setBekreftValg(v);
  };

  const veksle = (key: string) =>
    setEkspandert((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const erBallHolder = (m: VideresendMedlem) =>
    (m.mottaker.userId != null && m.mottaker.userId === recipientUserId) ||
    (m.mottaker.groupId != null && m.mottaker.groupId === recipientGroupId);

  const initialer = (navn: string) =>
    navn
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((d) => d[0]?.toUpperCase() ?? "")
      .join("");

  // Videresend innen egen flyt: direkte, med valgfri kommentar. Server honorerer recipientUserId.
  const videresendEgen = (m: VideresendMedlem) => {
    onVideresend(
      { ...m.mottaker, dokumentflytId: aktivDokumentflytId },
      kommentar.trim() || undefined,
    );
    lukkAlt();
  };

  // Bekreft flyt-bytte: påkrevd kommentar. Valgte man en PERSON (bekreftMedlem) sendes dennes
  // recipientUserId/-groupId — serveren honorerer det (oppgave.ts:1432-1433). Uten personvalg
  // sender vi valgets standard-mottaker, som serveren auto-utleder til hovedansvarlig utfører.
  const videresendBytte = () => {
    if (!bekreftValg || kommentar.trim().length === 0) return;
    const mottaker = bekreftMedlem?.mottaker ?? bekreftValg.mottaker ?? {};
    onVideresend(
      { ...mottaker, dokumentflytId: bekreftValg.dokumentflytId },
      kommentar.trim(),
    );
    lukkAlt();
  };

  const modalTittel = dokumentTittel
    ? t("videresend.modalTittelMed", { tittel: dokumentTittel })
    : t("videresend.modalTittel");

  /* ---------------- Bekreftelsessteg (flyt-bytte) ---------------- */
  if (bekreftValg) {
    // Valgte man en person: navngi DEN — ikke «hovedansvarlig utfører». Uten personvalg står
    // hovedansvarlig-utleder, som serveren faktisk gjør (mottakerNavnIValg).
    const autoMottaker = mottakerNavnIValg(bekreftValg);
    const kanSende = kommentar.trim().length > 0 && !erLaster;
    // Feil 2 (Kenneth 17.09): bekreftelsessteget navnga ikke dokumentet. Ta tittelen med her også.
    const bekreftTittel = dokumentTittel
      ? t("videresend.bekreftTittelMed", { tittel: dokumentTittel })
      : t("videresend.bekreftTittel");
    return (
      <Modal open={åpen} onClose={lukkAlt} title={bekreftTittel} className="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            <div>
              {t("videresend.konsekvensForlaterGaar", {
                fra: egenFlytNavn ?? t("videresend.dokumentetsFlyt"),
                til: bekreftValg.dokumentflytNavn,
              })}
            </div>
            <div className="mt-1">
              {bekreftMedlem
                ? t("videresend.konsekvensBallPerson", {
                    mottaker: bekreftMedlem.navn,
                    rolle: rolleEtikett(bekreftMedlem.rolle),
                  })
                : autoMottaker
                  ? t("videresend.konsekvensBall", { mottaker: autoMottaker })
                  : t("videresend.konsekvensBallUtenNavn")}
            </div>
            <div className="mt-1">{t("videresend.konsekvensMottakerSer")}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              {t("videresend.kommentarPaakrevd")} <span className="text-red-600">*</span>
            </label>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={t("videresend.kommentarPlaceholder")}
            />
            <p className="mt-1 text-[11px] text-gray-500">{t("videresend.kommentarPaakrevdHjelp")}</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setBekreftValg(null);
                setBekreftMedlem(null);
                setKommentar("");
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              onClick={videresendBytte}
              disabled={!kanSende}
              className="rounded-lg bg-sitedoc-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("videresend.flyttKnapp", { flyt: bekreftValg.dokumentflytNavn })}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  /* ---------------- Velg-steg (to seksjoner) ---------------- */
  return (
    <Modal open={åpen} onClose={lukkAlt} title={modalTittel} className="max-w-md">
      <div className="flex flex-col gap-3">
        {egenFlytNavn && (
          <p className="text-xs text-gray-500">
            {ballHolderNavn
              ? t("videresend.liggerIFlytenMedBall", { flyt: egenFlytNavn, ballholder: ballHolderNavn })
              : t("videresend.liggerIFlyten", { flyt: egenFlytNavn })}
          </p>
        )}

        {/* Seksjon: I denne flyten */}
        {egenFlytMedlemmer.length > 0 && (
          <div>
            <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-green-700">
              {t("videresend.seksjonEgenFlyt")}
            </div>
            <div className="flex flex-col">
              {egenFlytMedlemmer.map((m) => (
                <button
                  key={m.key}
                  data-testid={`videresend-egen-${m.key}`}
                  onClick={() => videresendEgen(m)}
                  disabled={erLaster}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-sitedoc-primary">
                    {initialer(m.navn)}
                  </span>
                  <span className="flex-1 text-sm text-gray-800">
                    {m.navn}
                    <span className="ml-1 text-[11px] text-gray-500">· {rolleEtikett(m.rolle)}</span>
                  </span>
                  {erBallHolder(m) && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {t("videresend.harBallen")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Seksjon: Andre flyter (kun når kanByttFlyt) */}
        {kanByttFlyt && andreFlyter.length > 0 && (
          <div>
            <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              {t("videresend.seksjonAndreFlyter")}
            </div>
            <div className="flex flex-col">
              {andreFlyter.map((v) => {
                const erÅpen = ekspandert.has(v.key);
                const antall = v.medlemmer.length;
                return (
                  <div key={v.key} className="rounded-lg px-2 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: v.farge ?? "#94a3b8" }}
                      />
                      <button
                        data-testid={`videresend-andre-${v.key}`}
                        onClick={() => åpneBekreft(v, null)}
                        className="flex-1 text-left text-sm font-semibold text-gray-800"
                      >
                        {v.visningsnavn}
                      </button>
                      {antall > 0 && (
                        <button
                          onClick={() => veksle(v.key)}
                          aria-label={t("statushandling.velgPerson")}
                          className="flex shrink-0 items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          {t("videresend.antallPersoner", { antall })}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${erÅpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    <div className="ml-[18px] mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                      <ArrowLeftRight className="h-3 w-3 shrink-0" />
                      {t("videresend.konsekvensLinje", { flyt: v.dokumentflytNavn })}
                    </div>
                    {erÅpen && antall > 0 && (
                      <div className="ml-[18px] mt-1.5 border-l-2 border-gray-200 pl-3">
                        {v.medlemmer.map((m) => (
                          <button
                            key={m.key}
                            data-testid={`videresend-andre-person-${v.key}-${m.key}`}
                            onClick={() => åpneBekreft(v, m)}
                            disabled={erLaster}
                            className="flex w-full items-center rounded py-1 text-left text-[13px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {m.navn}
                            <span className="ml-1 text-[11px] text-gray-400">· {rolleEtikett(m.rolle)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Valgfri kommentar for videresend innen egen flyt */}
        {egenFlytMedlemmer.length > 0 && (
          <div>
            <input
              type="text"
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={t("videresend.valgfriKommentarEgen")}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
