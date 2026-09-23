"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select, Modal } from "@sitedoc/ui";
import { Trash2, Pencil, Plus, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Område-administrasjon pr. byggeplass (steg 1, 2026-09-23). Liste med bruksantall, opprett,
 * omdøp, slett MED VAKT, og sortering. ADMIN-only for endring (server-gatet i omrade.ts —
 * `verifiserAdmin`); alle medlemmer ser lista. Ikke-admin får skjult opprett/endre-UI med
 * begrunnelse, ikke en feilmelding når de trykker (samme regel som `fix/utilgjengelige-flyter`).
 *
 * Slettevakten sitter på SERVEREN (blokkerer når området er i bruk). UI-en viser tallet fra
 * `bruksAntall` proaktivt, og server-nektelsen som en melding hvis brukeren likevel prøver.
 */

const OMRADE_TYPER = ["sone", "rom", "etasje", "trase"] as const;
type OmradeType = (typeof OMRADE_TYPER)[number];

export function OmradeAdmin({ byggeplassId, prosjektId }: { byggeplassId: string; prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: minTilgang } = trpc.gruppe.hentMinTilgang.useQuery({ projectId: prosjektId });
  const erAdmin = minTilgang?.erAdmin ?? false;

  const { data: omrader } = trpc.omrade.hentForByggeplass.useQuery({ byggeplassId });
  const { data: bruk } = trpc.omrade.bruksAntall.useQuery({ byggeplassId });
  const brukMap = new Map((bruk ?? []).map((b) => [b.id, b]));

  const [nyttNavn, setNyttNavn] = useState("");
  const [nyType, setNyType] = useState<OmradeType>("sone");
  const [redigerId, setRedigerId] = useState<string | null>(null);
  const [redigerNavn, setRedigerNavn] = useState("");
  const [slettKandidat, setSlettKandidat] = useState<{ id: string; navn: string } | null>(null);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);

  const invalider = () => {
    utils.omrade.hentForByggeplass.invalidate({ byggeplassId });
    utils.omrade.bruksAntall.invalidate({ byggeplassId });
  };
  const opprettM = trpc.omrade.opprett.useMutation({ onSuccess: () => { setNyttNavn(""); invalider(); } });
  const oppdaterM = trpc.omrade.oppdater.useMutation({ onSuccess: () => { setRedigerId(null); invalider(); } });
  const slettM = trpc.omrade.slett.useMutation({
    onSuccess: () => { setSlettKandidat(null); setSlettFeil(null); invalider(); },
    onError: (e: { message: string }) => setSlettFeil(e.message),
  });

  const liste = omrader ?? [];

  function håndterOpprett() {
    const navn = nyttNavn.trim();
    if (!navn) return;
    opprettM.mutate({ projectId: prosjektId, byggeplassId, navn, type: nyType });
  }

  function håndterOmdøp(id: string) {
    const navn = redigerNavn.trim();
    if (!navn) return;
    oppdaterM.mutate({ id, navn });
  }

  // Sortering: bytt `sortering`-verdi med naboen i visningsrekkefølgen (én-stegs opp/ned).
  function flytt(id: string, retning: -1 | 1) {
    const i = liste.findIndex((o) => o.id === id);
    const j = i + retning;
    if (i < 0 || j < 0 || j >= liste.length) return;
    const a = liste[i]!;
    const b = liste[j]!;
    oppdaterM.mutate({ id: a.id, sortering: b.sortering });
    oppdaterM.mutate({ id: b.id, sortering: a.sortering });
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("omrade.seksjon.tittel")}
      </h3>

      {liste.length === 0 && (
        <p className="mb-2 text-sm text-gray-400">{t("omrade.seksjon.tom")}</p>
      )}

      <ul className="space-y-1">
        {liste.map((o, idx) => {
          const b = brukMap.get(o.id);
          const antall = (b?.kpAntall ?? 0) + (b?.roAntall ?? 0);
          const redigerer = redigerId === o.id;
          return (
            <li key={o.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: o.farge }} />
              {redigerer ? (
                <>
                  <Input
                    value={redigerNavn}
                    onChange={(e) => setRedigerNavn(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label={t("handling.lagre")}
                    onClick={() => håndterOmdøp(o.id)}
                    className="rounded p-1 text-green-600 hover:bg-green-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("handling.avbryt")}
                    onClick={() => setRedigerId(null)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{o.navn}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                    {t(`omrade.type.${o.type}`)}
                  </span>
                  <span className="text-xs text-gray-400" title={t("omrade.bruk.tittel")}>
                    {t("omrade.bruk.antall", { antall })}
                  </span>
                  {erAdmin && (
                    <div className="flex items-center">
                      <button
                        type="button"
                        aria-label={t("omrade.handling.flyttOpp")}
                        disabled={idx === 0}
                        onClick={() => flytt(o.id, -1)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("omrade.handling.flyttNed")}
                        disabled={idx === liste.length - 1}
                        onClick={() => flytt(o.id, 1)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("omrade.handling.omdop")}
                        onClick={() => { setRedigerId(o.id); setRedigerNavn(o.navn); }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("handling.slett")}
                        onClick={() => { setSlettFeil(null); setSlettKandidat({ id: o.id, navn: o.navn }); }}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {erAdmin ? (
        <div className="mt-3 flex items-end gap-2">
          <Input
            label={t("omrade.opprett.navn")}
            value={nyttNavn}
            onChange={(e) => setNyttNavn(e.target.value)}
            placeholder={t("omrade.opprett.navnPlaceholder")}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") håndterOpprett(); }}
          />
          <Select
            label={t("omrade.opprett.type")}
            value={nyType}
            onChange={(e) => setNyType(e.target.value as OmradeType)}
            options={OMRADE_TYPER.map((ty) => ({ value: ty, label: t(`omrade.type.${ty}`) }))}
          />
          <Button size="sm" onClick={håndterOpprett} loading={opprettM.isPending} disabled={!nyttNavn.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            {t("handling.leggTil")}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">{t("omrade.kunAdmin")}</p>
      )}

      {/* Slett-bekreftelse via modal (CLAUDE.md: aldri confirm()). Server-vakten blokkerer i-bruk. */}
      <Modal
        open={slettKandidat !== null}
        onClose={() => { setSlettKandidat(null); setSlettFeil(null); }}
        title={t("omrade.slett.tittel")}
      >
        <p className="text-sm text-gray-600">
          {t("omrade.slett.bekreft", { navn: slettKandidat?.navn ?? "" })}
        </p>
        {slettFeil && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{slettFeil}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setSlettKandidat(null); setSlettFeil(null); }}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            loading={slettM.isPending}
            onClick={() => slettKandidat && slettM.mutate({ id: slettKandidat.id })}
          >
            {t("handling.slett")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
