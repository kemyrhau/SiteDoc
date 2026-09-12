"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, Input } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Check, AlertCircle } from "lucide-react";
import { FeltKonfigurasjon } from "@/components/malbygger/FeltKonfigurasjon";
import {
  feltTilObjekt,
  grupperEtterFase,
  flyttInnenforFase,
  BIBLIOTEK_FASER,
  type BibliotekFelt,
} from "@/lib/bibliotek-mal";

// Felttypene sentralarkivet redigeres med (spec kontrollplan.md:619). Ukjente
// typer i eldre maler beholdes (legges til i nedtrekket ad hoc) — aldri tapt.
const FELTTYPER: { verdi: string; nokkel: string }[] = [
  { verdi: "traffic_light", nokkel: "malbygger.trafikklys" },
  { verdi: "list_single", nokkel: "malbygger.enkeltvalg" },
  { verdi: "decimal", nokkel: "malbygger.desimaltall" },
  { verdi: "text_field", nokkel: "malbygger.tekstfelt" },
];

const FASE_NOKKEL: Record<string, string> = {
  FØR: "adminBibliotek.faseFOR",
  UNDER: "adminBibliotek.faseUNDER",
  ETTER: "adminBibliotek.faseETTER",
};

export default function BibliotekAdminSide() {
  const { t } = useTranslation();
  const standarderQuery = trpc.bibliotek.hentStandarder.useQuery();
  const [apneStandarder, setApneStandarder] = useState<Record<string, boolean>>({});
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);

  return (
    <div className="flex h-full gap-4">
      {/* Venstre — trestruktur */}
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h1 className="text-sm font-semibold text-gray-900">{t("adminBibliotek.tittel")}</h1>
          <p className="text-xs text-gray-500">{t("adminBibliotek.undertittel")}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {standarderQuery.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            (standarderQuery.data ?? []).map((standard) => {
              const apen = apneStandarder[standard.id] ?? true;
              return (
                <div key={standard.id} className="mb-1">
                  <button
                    onClick={() => setApneStandarder((p) => ({ ...p, [standard.id]: !apen }))}
                    className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
                  >
                    {apen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{standard.kode} — {standard.navn}</span>
                  </button>
                  {apen && standard.kapitler.map((kapittel) => (
                    <div key={kapittel.id} className="ml-4 mt-0.5">
                      <div className="px-2 py-1 text-xs font-medium text-gray-500">{kapittel.kode} — {kapittel.navn}</div>
                      {kapittel.maler.map((mal) => (
                        <button
                          key={mal.id}
                          onClick={() => setValgtMalId(mal.id)}
                          className={`ml-2 block w-full truncate rounded px-2 py-1 text-left text-sm ${
                            valgtMalId === mal.id ? "bg-amber-50 font-medium text-amber-700" : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {mal.navn}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Høyre — malredigering */}
      <section className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {valgtMalId ? (
          <MalRedigering key={valgtMalId} bibliotekMalId={valgtMalId} onLagret={() => standarderQuery.refetch()} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t("adminBibliotek.velgMal")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function MalRedigering({ bibliotekMalId, onLagret }: { bibliotekMalId: string; onLagret: () => void }) {
  const { t } = useTranslation();
  const malQuery = trpc.bibliotek.hentMalRedigering.useQuery({ bibliotekMalId });

  const [navn, setNavn] = useState("");
  const [referanse, setReferanse] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [felter, setFelter] = useState<BibliotekFelt[]>([]);
  const [valgtIndeks, setValgtIndeks] = useState<number | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [lagretNaa, setLagretNaa] = useState(false);

  // Init lokal state når malen lastes.
  useEffect(() => {
    if (!malQuery.data) return;
    const raw = (malQuery.data.malInnhold ?? []) as unknown as BibliotekFelt[];
    setNavn(malQuery.data.navn);
    setReferanse(malQuery.data.referanse);
    setBeskrivelse(malQuery.data.beskrivelse ?? "");
    setFelter([...raw].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    setValgtIndeks(null);
    setFeil(null);
    setLagretNaa(false);
  }, [malQuery.data]);

  const oppdaterMutation = trpc.bibliotek.oppdaterMal.useMutation({
    onSuccess: () => { setFeil(null); setLagretNaa(true); onLagret(); },
    // Krav 5: knappen skal ikke lyve — server-melding vises, aldri stille feil.
    onError: (e) => { setLagretNaa(false); setFeil(e.message); },
  });

  const alleObjekter = useMemo(() => felter.map((f, i) => feltTilObjekt(f, i)), [felter]);
  const grupper = useMemo(() => grupperEtterFase(felter), [felter]);

  // Auto-persist: hver endring lagres direkte, så det finnes ingen ulagret draft å
  // miste. Kalles med eksplisitte verdier for å unngå stale closure.
  function persister(nyeFelter: BibliotekFelt[], meta?: { navn?: string; referanse?: string; beskrivelse?: string }) {
    oppdaterMutation.mutate({
      bibliotekMalId,
      navn: meta?.navn ?? navn,
      referanse: meta?.referanse ?? referanse,
      beskrivelse: (meta?.beskrivelse ?? beskrivelse) || null,
      malInnhold: nyeFelter,
    });
  }

  function endreFelt(indeks: number, endring: Partial<BibliotekFelt>) {
    const nye = felter.map((f, i) => (i === indeks ? { ...f, ...endring } : f));
    setFelter(nye);
    persister(nye);
  }

  function flytt(indeks: number, retning: "opp" | "ned") {
    const nye = flyttInnenforFase(felter, indeks, retning);
    if (nye === felter) return; // alt ytterst i fasen
    setFelter(nye);
    setValgtIndeks(null);
    persister(nye);
  }

  if (malQuery.isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (malQuery.error) return <div className="flex h-full items-center justify-center"><p className="text-sm text-red-600">{malQuery.error.message}</p></div>;

  const valgtFelt = valgtIndeks != null ? felter[valgtIndeks] : null;
  const typer = valgtFelt && !FELTTYPER.some((ft) => ft.verdi === valgtFelt.type)
    ? [...FELTTYPER, { verdi: valgtFelt.type, nokkel: "" }]
    : FELTTYPER;

  return (
    <div className="flex h-full">
      {/* Midten — mal-metadata + feltliste per fase */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-4">
          <Input
            label={t("adminBibliotek.malnavn")}
            value={navn}
            onChange={(e) => { setNavn(e.target.value); setLagretNaa(false); }}
            onBlur={() => navn && persister(felter, { navn })}
          />
          <div className="flex gap-3">
            <div className="w-40"><Input
              label={t("adminBibliotek.referanse")}
              value={referanse}
              onChange={(e) => { setReferanse(e.target.value); setLagretNaa(false); }}
              onBlur={() => referanse && persister(felter, { referanse })}
            /></div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{t("adminBibliotek.beskrivelse")}</label>
            <textarea
              className="min-h-[60px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={beskrivelse}
              onChange={(e) => { setBeskrivelse(e.target.value); setLagretNaa(false); }}
              onBlur={() => persister(felter, { beskrivelse })}
            />
          </div>
        </div>

        {felter.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t("adminBibliotek.ingenFelter")}</p>
        ) : (
          grupper.map((gruppe) => (
            <div key={gruppe.fase ?? "ingen"} className="mb-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {gruppe.fase ? t(FASE_NOKKEL[gruppe.fase] ?? gruppe.fase) : t("adminBibliotek.utenFase")}
              </h3>
              <div className="rounded-md border border-gray-200">
                {gruppe.felter.map(({ felt, indeks }) => (
                  <div
                    key={indeks}
                    className={`flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 ${
                      valgtIndeks === indeks ? "bg-amber-50" : ""
                    }`}
                  >
                    <button className="flex-1 truncate text-left text-sm text-gray-800" onClick={() => setValgtIndeks(indeks)}>
                      {felt.label || <span className="text-gray-400">—</span>}
                    </button>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {t(FELTTYPER.find((ft) => ft.verdi === felt.type)?.nokkel ?? "") || felt.type}
                    </span>
                    <button title={t("adminBibliotek.flyttOpp")} onClick={() => flytt(indeks, "opp")} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button title={t("adminBibliotek.flyttNed")} onClick={() => flytt(indeks, "ned")} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="mt-4 flex items-center gap-3">
          {oppdaterMutation.isPending && <Spinner />}
          {!oppdaterMutation.isPending && lagretNaa && (
            <span className="inline-flex items-center gap-1 text-sm text-green-700">
              <Check className="h-4 w-4" /> {t("adminBibliotek.lagret")}
            </span>
          )}
          <span className="text-xs text-gray-400">{t("adminBibliotek.verifisertMerknad")}</span>
        </div>

        {feil && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">{t("adminBibliotek.lagreFeiletTittel")}</p>
              <p className="text-sm text-red-700">{feil}</p>
            </div>
          </div>
        )}
      </div>

      {/* Høyre — feltkonfigurasjon (gjenbruk fra malbygger) + type/fase */}
      {valgtFelt && valgtIndeks != null ? (
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-gray-50">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{t("adminBibliotek.felttype")}</label>
              <select
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={valgtFelt.type}
                onChange={(e) => endreFelt(valgtIndeks, { type: e.target.value })}
              >
                {typer.map((ft) => (
                  <option key={ft.verdi} value={ft.verdi}>{ft.nokkel ? t(ft.nokkel) : ft.verdi}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{t("adminBibliotek.fase")}</label>
              <select
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={valgtFelt.fase ?? ""}
                onChange={(e) => endreFelt(valgtIndeks, { fase: e.target.value || null })}
              >
                {BIBLIOTEK_FASER.map((f) => (
                  <option key={f} value={f}>{t(FASE_NOKKEL[f] ?? f)}</option>
                ))}
                <option value="">{t("adminBibliotek.utenFase")}</option>
              </select>
            </div>
          </div>
          {/* FeltKonfigurasjon fører etikett, hjelpetekst, valgopsjoner og grense-config */}
          <FeltKonfigurasjon
            objekt={feltTilObjekt(valgtFelt, valgtIndeks)}
            alleObjekter={alleObjekter}
            onLagre={({ label, required, config }) => endreFelt(valgtIndeks, { label, required, config })}
            erLagrer={false}
          />
        </div>
      ) : (
        <aside className="flex w-80 shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 p-4">
          <p className="text-center text-sm text-gray-400">{t("malbygger.velgFelt")}</p>
        </aside>
      )}
    </div>
  );
}
