"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { X, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { UkeVelger } from "./UkeVelger";
import { byggUnderkapittelBlokker } from "@/components/bibliotek/arkiv-fane-filter";

interface Milepel {
  id: string;
  navn: string;
  maalUke: number;
  maalAar: number;
}

interface OpprettPunktDialogProps {
  kontrollplanId: string;
  projectId: string;
  byggeplassId: string;
  milepeler: Milepel[];
  onLukk: () => void;
  onOpprettet: () => void;
}

interface PunktFrist {
  omradeId: string | null;
  omradeNavn: string;
  fristUke: number | null;
  fristAar: number | null;
}

const naaAar = new Date().getFullYear();

export function OpprettPunktDialog({
  kontrollplanId,
  projectId,
  byggeplassId,
  milepeler,
  onLukk,
  onOpprettet,
}: OpprettPunktDialogProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Hent maler, områder, faggrupper og bibliotek-koblinger
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId });
  const { data: omrader } = trpc.omrade.hentForByggeplass.useQuery({ byggeplassId });
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery({ projectId });
  const { data: bibliotekValg } = trpc.bibliotek.hentProsjektValg.useQuery({ projectId });
  // Område-opprett er ADMIN-only fra 2026-09-23 (Kenneth: «og bare admin»). Inline-opprett
  // skjules for ikke-admin — de velger eksisterende områder fra nedtrekket i stedet.
  const { data: minOmradeTilgang } = trpc.gruppe.hentMinTilgang.useQuery({ projectId });
  const kanAdministrereOmrade = minOmradeTilgang?.erAdmin ?? false;

  // Formstate
  const [valgtMalId, setValgtMalId] = useState<string>("");
  const [valgtFaggruppeId, setValgtFaggruppeId] = useState<string>("");
  const [valgtMilepelId, setValgtMilepelId] = useState<string>("");
  const [valgteOmradeIder, setValgteOmradeIder] = useState<Set<string>>(new Set());
  const [punktFrister, setPunktFrister] = useState<PunktFrist[]>([]);
  const [malSok, setMalSok] = useState("");

  // Inline opprettelse
  const [visNyttOmrade, setVisNyttOmrade] = useState(false);
  const [nyttOmradeNavn, setNyttOmradeNavn] = useState("");
  const [nyttOmradeType, setNyttOmradeType] = useState<"sone" | "rom" | "etasje">("sone");
  const [visNyMilepel, setVisNyMilepel] = useState(false);
  const [nyMilepelNavn, setNyMilepelNavn] = useState("");
  const [nyMilepelUke, setNyMilepelUke] = useState<number | null>(null);
  const [nyMilepelAar, setNyMilepelAar] = useState<number | null>(null);

  // Mutations
  const opprettPunkter = trpc.kontrollplan.opprettPunkter.useMutation({
    onSuccess: () => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onOpprettet();
      onLukk();
    },
  });
  const opprettOmrade = trpc.omrade.opprett.useMutation({
    onSuccess: () => {
      utils.omrade.hentForByggeplass.invalidate({ byggeplassId });
      setVisNyttOmrade(false);
      setNyttOmradeNavn("");
    },
  });
  const opprettMilepel = trpc.kontrollplan.opprettMilepel.useMutation({
    onSuccess: () => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      setVisNyMilepel(false);
      setNyMilepelNavn("");
    },
  });

  // Bygg trestruktur: Standard (Kenneths «kapittel») → flate maler + "Prosjektmaler".
  // Underkapittel-overskrift (kodens «kapittel») skytes inn av byggUnderkapittelBlokker i
  // render KUN ved 3+ maler — samme regel som de tre andre standard-flatene.
  interface MalNode { id: string; name: string; prefix: string | null }
  interface MalMedKapittel extends MalNode {
    kapittelKode: string | null;
    kapittelNavn: string | null;
    referanse: string;
  }
  interface StandardNode { kode: string; navn: string; maler: MalMedKapittel[] }

  const malTre = useMemo(() => {
    if (!maler) return { standarder: [] as StandardNode[], prosjektmaler: [] as MalNode[] };

    const sjekklister = maler.filter((m: { category: string }) => m.category === "sjekkliste");
    const sok = malSok.toLowerCase();

    // Bygg map: sjekklisteMalId → bibliotek-info (inkl. referanse for rekkefølge)
    const bibMap = new Map<
      string,
      { kapittelKode: string; kapittelNavn: string; standardKode: string; standardNavn: string; referanse: string }
    >();
    if (bibliotekValg) {
      for (const v of bibliotekValg) {
        if (v.sjekklisteMalId && v.bibliotekMal) {
          bibMap.set(v.sjekklisteMalId, {
            kapittelKode: v.bibliotekMal.kapittel.kode,
            kapittelNavn: v.bibliotekMal.kapittel.navn,
            standardKode: v.bibliotekMal.kapittel.standard.kode,
            standardNavn: v.bibliotekMal.kapittel.standard.navn,
            referanse: v.bibliotekMal.referanse,
          });
        }
      }
    }

    const standardMap = new Map<string, { kode: string; navn: string; maler: MalMedKapittel[] }>();
    const prosjektmaler: MalNode[] = [];

    for (const m of sjekklister) {
      const mal = m as { id: string; name: string; prefix: string | null };
      // Søkefilter
      if (sok && !mal.name.toLowerCase().includes(sok) && !(mal.prefix ?? "").toLowerCase().includes(sok)) continue;

      const bib = bibMap.get(mal.id);
      if (bib) {
        if (!standardMap.has(bib.standardKode)) {
          standardMap.set(bib.standardKode, { kode: bib.standardKode, navn: bib.standardNavn, maler: [] });
        }
        standardMap.get(bib.standardKode)!.maler.push({
          ...mal,
          kapittelKode: bib.kapittelKode,
          kapittelNavn: bib.kapittelNavn,
          referanse: bib.referanse,
        });
      } else {
        prosjektmaler.push(mal);
      }
    }

    const standarder: StandardNode[] = [...standardMap.values()].map((s) => ({
      kode: s.kode,
      navn: s.navn,
      // Referanserekkefølge: underkapittel-for-underkapittel (kode), så referanse (numerisk,
      // KC3.1 < KC10) — så byggUnderkapittelBlokker ser hvert underkapittel som én sekvens.
      maler: [...s.maler].sort(
        (a, b) =>
          (a.kapittelKode ?? "").localeCompare(b.kapittelKode ?? "") ||
          a.referanse.localeCompare(b.referanse, undefined, { numeric: true }),
      ),
    }));

    return { standarder, prosjektmaler };
  }, [maler, bibliotekValg, malSok]);

  // Valgt mal-navn for visning i søkefeltet
  const valgtMalNavn = useMemo(() => {
    if (!valgtMalId || !maler) return "";
    const m = maler.find((m: { id: string }) => m.id === valgtMalId) as { prefix: string | null; name: string } | undefined;
    return m ? `${m.prefix ? m.prefix + " — " : ""}${m.name}` : "";
  }, [valgtMalId, maler]);

  // Hent valgt milepæls frist som default for nye punkter
  const valgtMilepel = milepeler.find((m) => m.id === valgtMilepelId);
  const defaultFristUke = valgtMilepel?.maalUke ?? null;
  const defaultFristAar = valgtMilepel?.maalAar ?? naaAar;

  // Bygg forhåndsvisning
  const forhåndsvisning = useMemo(() => {
    if (!valgtMalId || !valgtFaggruppeId) return [];
    const mal = maler?.find((m: { id: string }) => m.id === valgtMalId);
    const fg = faggrupper?.find((f: { id: string }) => f.id === valgtFaggruppeId);
    if (!mal || !fg) return [];

    if (valgteOmradeIder.size === 0) {
      // Ingen områder → ett punkt uten område
      const frist = punktFrister.find((f) => f.omradeId === null);
      return [{ omradeId: null, omradeNavn: "—", malNavn: mal.name, fgNavn: fg.name, fristUke: frist?.fristUke ?? defaultFristUke, fristAar: frist?.fristAar ?? defaultFristAar }];
    }

    return [...valgteOmradeIder].map((oid) => {
      const omr = omrader?.find((o: { id: string }) => o.id === oid);
      const eksisterendeFrist = punktFrister.find((f) => f.omradeId === oid);
      return {
        omradeId: oid,
        omradeNavn: omr?.navn ?? "?",
        malNavn: mal.name,
        fgNavn: fg.name,
        fristUke: eksisterendeFrist?.fristUke ?? defaultFristUke,
        fristAar: eksisterendeFrist?.fristAar ?? defaultFristAar,
      };
    });
  }, [valgtMalId, valgtFaggruppeId, valgteOmradeIder, maler, faggrupper, omrader, punktFrister, defaultFristUke, defaultFristAar]);

  // Toggle område-valg
  function toggleOmrade(omradeId: string) {
    const ny = new Set(valgteOmradeIder);
    if (ny.has(omradeId)) {
      ny.delete(omradeId);
      setPunktFrister((prev) => prev.filter((f) => f.omradeId !== omradeId));
    } else {
      ny.add(omradeId);
      const omr = omrader?.find((o: { id: string }) => o.id === omradeId);
      setPunktFrister((prev) => [...prev, { omradeId, omradeNavn: omr?.navn ?? "", fristUke: defaultFristUke, fristAar: defaultFristAar }]);
    }
    setValgteOmradeIder(ny);
  }

  // Oppdater frist for et område
  function oppdaterFrist(omradeId: string | null, felt: "fristUke" | "fristAar", verdi: number | null) {
    setPunktFrister((prev) =>
      prev.map((f) => (f.omradeId === omradeId ? { ...f, [felt]: verdi } : f))
    );
  }

  // Submit
  function handleSubmit() {
    if (!valgtMalId || !valgtFaggruppeId) return;

    const punkterData = valgteOmradeIder.size === 0
      ? [{ omradeId: null, fristUke: punktFrister[0]?.fristUke ?? null, fristAar: punktFrister[0]?.fristAar ?? null }]
      : [...valgteOmradeIder].map((oid) => {
          const frist = punktFrister.find((f) => f.omradeId === oid);
          return { omradeId: oid, fristUke: frist?.fristUke ?? null, fristAar: frist?.fristAar ?? null };
        });

    opprettPunkter.mutate({
      kontrollplanId,
      sjekklisteMalId: valgtMalId,
      faggruppeId: valgtFaggruppeId,
      milepelId: valgtMilepelId || null,
      punkter: punkterData,
    });
  }

  const kanSubmit = !!valgtMalId && !!valgtFaggruppeId;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh] overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("kontrollplan.leggTilPunkt")}</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 1. Sjekkliste-mal — trestruktur */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.sjekklisteMal")}</label>
            <input
              type="text"
              value={valgtMalId ? valgtMalNavn : malSok}
              onChange={(e) => { setMalSok(e.target.value); if (valgtMalId) setValgtMalId(""); }}
              onFocus={() => { if (valgtMalId) { setMalSok(""); setValgtMalId(""); } }}
              placeholder={`${t("kontrollplan.sjekklisteMal")}...`}
              className="w-full border rounded px-2 py-1.5 text-sm mb-1"
            />
            <div className="border rounded max-h-48 overflow-y-auto text-sm">
              {/* Standarder → Maler (med valgfrie underkapittel-headere) */}
              {malTre.standarder.map((std) => (
                <MalTreStandard
                  key={std.kode}
                  standard={std}
                  valgtMalId={valgtMalId}
                  onVelg={(id) => { setValgtMalId(id); setMalSok(""); }}
                />
              ))}
              {/* Prosjektmaler */}
              {malTre.prosjektmaler.length > 0 && (
                <MalTreGruppe
                  tittel="Prosjektmaler"
                  maler={malTre.prosjektmaler}
                  valgtMalId={valgtMalId}
                  onVelg={(id) => { setValgtMalId(id); setMalSok(""); }}
                />
              )}
              {malTre.standarder.length === 0 && malTre.prosjektmaler.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">{t("kontrollplan.ingenMaler")}</div>
              )}
            </div>
          </div>

          {/* 2. Områder (flervalg) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.omrader")}</label>
            {omrader && omrader.length > 0 ? (
              <div className="border rounded max-h-36 overflow-y-auto p-2 space-y-1">
                {omrader.map((o: { id: string; navn: string; type: string }) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={valgteOmradeIder.has(o.id)}
                      onChange={() => toggleOmrade(o.id)}
                      className="rounded text-sitedoc-primary"
                    />
                    <span>{o.navn}</span>
                    <span className="text-[10px] text-gray-400">{o.type}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t("kontrollplan.velgByggeplass")}</p>
            )}
            {/* Inline opprett område — ADMIN-only (skjult for ikke-admin) */}
            {!kanAdministrereOmrade ? null : !visNyttOmrade ? (
              <button onClick={() => setVisNyttOmrade(true)} className="text-xs text-sitedoc-secondary hover:underline mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> {t("kontrollplan.opprettOmrade")}
              </button>
            ) : (
              <div className="mt-2 border rounded p-2 space-y-2 bg-gray-50">
                <input
                  type="text"
                  value={nyttOmradeNavn}
                  onChange={(e) => setNyttOmradeNavn(e.target.value)}
                  placeholder={t("kontrollplan.navn")}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div className="flex gap-3">
                  {(["sone", "rom", "etasje"] as const).map((tp) => (
                    <label key={tp} className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={nyttOmradeType === tp}
                        onChange={() => setNyttOmradeType(tp)}
                      />
                      {tp}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (nyttOmradeNavn) {
                        opprettOmrade.mutate({ projectId, byggeplassId, navn: nyttOmradeNavn, type: nyttOmradeType });
                      }
                    }}
                    disabled={!nyttOmradeNavn || opprettOmrade.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("kontrollplan.opprettOmrade")}
                  </button>
                  <button onClick={() => setVisNyttOmrade(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Faggruppe */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.faggruppe")}</label>
            <select
              value={valgtFaggruppeId}
              onChange={(e) => setValgtFaggruppeId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {faggrupper?.map((fg: { id: string; name: string }) => (
                <option key={fg.id} value={fg.id}>{fg.name}</option>
              ))}
            </select>
          </div>

          {/* 4. Milepæl (valgfri) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.milepel")}</label>
            <select
              value={valgtMilepelId}
              onChange={(e) => setValgtMilepelId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {milepeler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.navn} ({t("kontrollplan.maalUke", { uke: m.maalUke })})
                </option>
              ))}
            </select>
            {/* Inline opprett milepæl */}
            {!visNyMilepel ? (
              <button onClick={() => setVisNyMilepel(true)} className="text-xs text-sitedoc-secondary hover:underline mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> {t("kontrollplan.opprettMilepel")}
              </button>
            ) : (
              <div className="mt-2 border rounded p-2 space-y-2 bg-gray-50">
                <input
                  type="text"
                  value={nyMilepelNavn}
                  onChange={(e) => setNyMilepelNavn(e.target.value)}
                  placeholder={t("kontrollplan.navn")}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div>
                  <label className="text-[10px] text-gray-400">{t("kontrollplan.frist")}</label>
                  <UkeVelger
                    uke={nyMilepelUke}
                    aar={nyMilepelAar}
                    onChange={(u, a) => { setNyMilepelUke(u || null); setNyMilepelAar(a || null); }}
                    placeholder={t("kontrollplan.frist") + "..."}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (nyMilepelNavn && nyMilepelUke && nyMilepelAar) {
                        opprettMilepel.mutate({ kontrollplanId, navn: nyMilepelNavn, maalUke: nyMilepelUke, maalAar: nyMilepelAar });
                      }
                    }}
                    disabled={!nyMilepelNavn || !nyMilepelUke || opprettMilepel.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("kontrollplan.opprettMilepel")}
                  </button>
                  <button onClick={() => setVisNyMilepel(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Forhåndsvisning med editerbare frister */}
          {forhåndsvisning.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("kontrollplan.forhandsvisning")}</p>
              <div className="space-y-2">
                {forhåndsvisning.map((fv, idx) => (
                  <div key={fv.omradeId ?? idx} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">•</span>
                    <span className="font-medium truncate max-w-[80px]">{fv.omradeNavn}</span>
                    <span className="text-gray-400">×</span>
                    <span className="truncate max-w-[100px]">{fv.malNavn}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-500 truncate max-w-[80px]">{fv.fgNavn}</span>
                    <div className="ml-auto w-[130px] flex-shrink-0">
                      <UkeVelger
                        uke={punktFrister.find((f) => f.omradeId === fv.omradeId)?.fristUke ?? null}
                        aar={punktFrister.find((f) => f.omradeId === fv.omradeId)?.fristAar ?? null}
                        onChange={(u, a) => {
                          if (fv.omradeId) {
                            oppdaterFrist(fv.omradeId, "fristUke", u || null);
                            oppdaterFrist(fv.omradeId, "fristAar", a || null);
                          } else {
                            setPunktFrister([{ omradeId: null, omradeNavn: "—", fristUke: u || null, fristAar: a || null }]);
                          }
                        }}
                        placeholder={t("kontrollplan.frist") + "..."}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onLukk} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            {t("handling.avbryt")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!kanSubmit || opprettPunkter.isPending}
            className="px-3 py-1.5 text-sm bg-sitedoc-primary text-white rounded hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {t("kontrollplan.opprettPunkter", { antall: Math.max(forhåndsvisning.length, 1) })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trestruktur-komponenter for mal-velger                             */
/*  Standard (accordion) → kapittel-header (visuell) → maler (klikk)  */
/* ------------------------------------------------------------------ */

function MalTreStandard({
  standard,
  valgtMalId,
  onVelg,
}: {
  standard: {
    kode: string;
    navn: string;
    maler: { id: string; name: string; prefix: string | null; kapittelKode: string | null; kapittelNavn: string | null }[];
  };
  valgtMalId: string;
  onVelg: (id: string) => void;
}) {
  // Kollaps på standard (Kenneths «kapittel»), default åpen.
  const [aapen, setAapen] = useState(true);
  // Underkapittel-overskrifter (>= terskel) starter åpne — settet holder de lukkede.
  const [lukkedeUnder, setLukkedeUnder] = useState<Set<string>>(new Set());

  function toggleUnder(key: string) {
    setLukkedeUnder((prev) => {
      const neste = new Set(prev);
      if (neste.has(key)) neste.delete(key);
      else neste.add(key);
      return neste;
    });
  }

  const malKnapp = (mal: { id: string; name: string }) => (
    <button
      key={mal.id}
      type="button"
      onClick={() => onVelg(mal.id)}
      className={`w-full text-left px-4 py-1.5 text-xs border-b border-gray-50 ${
        valgtMalId === mal.id
          ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
          : "text-gray-700 hover:bg-blue-50"
      }`}
    >
      {mal.name}
    </button>
  );

  return (
    <div>
      <div className="flex items-center bg-gray-50 border-b sticky top-0 z-10">
        <button
          type="button"
          onClick={() => setAapen(!aapen)}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${aapen ? "rotate-90" : ""}`} />
          {standard.navn}
        </button>
      </div>
      {aapen &&
        byggUnderkapittelBlokker(standard.maler, standard.kode).map((blokk) => {
          // Løse maler (underkapittel < terskel) — ingen overskrift.
          if (blokk.type === "lose") {
            return <div key={`lose-${blokk.maler[0]?.id}`}>{blokk.maler.map(malKnapp)}</div>;
          }
          // >= terskel → kollapsbar underkapittel-overskrift, default åpen.
          const apenUnder = !lukkedeUnder.has(blokk.key);
          return (
            <div key={blokk.key}>
              <button
                type="button"
                onClick={() => toggleUnder(blokk.key)}
                className="flex w-full items-center gap-1 px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50/50 border-b border-gray-100 hover:bg-gray-100"
              >
                {apenUnder ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {blokk.kode} — {blokk.navn}
                </span>
                <span className="shrink-0">· {blokk.maler.length}</span>
              </button>
              {apenUnder && blokk.maler.map(malKnapp)}
            </div>
          );
        })}
    </div>
  );
}

function MalTreGruppe({
  tittel,
  maler,
  valgtMalId,
  onVelg,
}: {
  tittel: string;
  maler: { id: string; name: string; prefix: string | null }[];
  valgtMalId: string;
  onVelg: (id: string) => void;
}) {
  const [aapen, setAapen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAapen(!aapen)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border-b sticky top-0"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${aapen ? "rotate-90" : ""}`} />
        {tittel}
      </button>
      {aapen && maler.map((mal) => (
        <button
          key={mal.id}
          type="button"
          onClick={() => onVelg(mal.id)}
          className={`w-full text-left px-4 py-1.5 text-xs border-b border-gray-50 ${
            valgtMalId === mal.id
              ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
              : "text-gray-700 hover:bg-blue-50"
          }`}
        >
          {mal.prefix ? <span className="text-gray-400 mr-1">{mal.prefix}</span> : null}
          {mal.name}
        </button>
      ))}
    </div>
  );
}
