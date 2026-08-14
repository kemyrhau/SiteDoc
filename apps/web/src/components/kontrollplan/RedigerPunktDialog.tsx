"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { X, Trash2, MapPin, Target } from "lucide-react";
import { UkeVelger } from "./UkeVelger";
import { avledPunktTilstand, isoUkeRef } from "@/lib/kontrollplanFremdrift";
import { TilstandMerke } from "./TilstandMerke";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";

interface Punkt {
  id: string;
  kontrollplanId: string;
  omradeId: string | null;
  milepelId: string | null;
  sjekklisteMalId: string;
  faggruppeId: string;
  fristUke: number | null;
  fristAar: number | null;
  status: string;
  varselUkerFor: number;
  avhengerAvId: string | null;
  dokumentflytId: string | null;
  drawingId: string | null;
  sjekklisteMal: { id: string; name: string; prefix: string | null; kontrollomrade: string | null };
  faggruppe: { id: string; name: string; color: string | null };
  omrade: { id: string; navn: string; type: string } | null;
  sjekkliste: { id: string; status: string; dokumentflytId: string | null; dokumentflyt: { id: string; name: string } | null } | null;
  dokumentflyt: { id: string; name: string } | null;
  drawing: { id: string; name: string } | null;
  avhengerAv: { id: string; status: string; sjekklisteMal: { name: string }; omrade: { navn: string } | null } | null;
}

interface RedigerPunktDialogProps {
  punkt: Punkt;
  allePunkter: Punkt[];
  onLukk: () => void;
  onOppdatert: () => void;
  // Start/koble/åpne-handling (samme komponent som lista bruker) — gjør punktet startbart
  // også fra matrisen, som åpner denne dialogen ved klikk.
  renderHandling?: (punkt: Punkt) => React.ReactNode;
}

export function RedigerPunktDialog({ punkt, allePunkter, onLukk, onOppdatert, projectId, renderHandling }: RedigerPunktDialogProps & { projectId: string }) {
  const { t } = useTranslation();
  const [fristUke, setFristUke] = useState(punkt.fristUke);
  const [fristAar, setFristAar] = useState(punkt.fristAar);
  const [avhengerAvId, setAvhengerAvId] = useState(punkt.avhengerAvId ?? "");
  const [visSkyvOmrade, setVisSkyvOmrade] = useState(false);
  const [skyvUker, setSkyvUker] = useState(1);
  const [visByttMal, setVisByttMal] = useState(false);
  const [nyMalId, setNyMalId] = useState("");
  const [visKaskade, setVisKaskade] = useState(false);
  const [kaskadeUker, setKaskadeUker] = useState(1);

  // Hent maler for bytt-mal
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId },
    { enabled: visByttMal },
  );

  const oppdaterPunkt = trpc.kontrollplan.oppdaterPunkt.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  const slettPunkt = trpc.kontrollplan.slettPunkt.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  const skyvOmrade = trpc.kontrollplan.skyvOmrade.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  const skyvKaskade = trpc.kontrollplan.skyvKaskade.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  // Hent berørte punkter for kaskade (lazy)
  const { data: kaskadeBerort } = trpc.kontrollplan.hentKaskadeBerort.useQuery(
    { punktId: punkt.id },
    { enabled: visKaskade },
  );

  // Antall punkter i samme område (for skyv-forhåndsvisning)
  const punkterISammeOmrade = useMemo(() => {
    if (!punkt.omradeId) return 0;
    return allePunkter.filter((p) => p.omradeId === punkt.omradeId).length;
  }, [allePunkter, punkt.omradeId]);

  // Avhengighets-kandidater: alle andre punkter, gruppert etter område
  const avhengighetsKandidater = useMemo(() => {
    const andre = allePunkter.filter((p) => p.id !== punkt.id);
    const gruppert = new Map<string, Punkt[]>();
    for (const p of andre) {
      const key = p.omrade?.navn ?? "—";
      if (!gruppert.has(key)) gruppert.set(key, []);
      gruppert.get(key)!.push(p);
    }
    return gruppert;
  }, [allePunkter, punkt.id]);

  function handleLagreFrist() {
    oppdaterPunkt.mutate({ punktId: punkt.id, fristUke, fristAar });
  }

  function handleLagreAvhengighet() {
    oppdaterPunkt.mutate({ punktId: punkt.id, avhengerAvId: avhengerAvId || null });
  }

  const statusIkon = (s: string) => {
    if (s === "godkjent") return "✅";
    if (s === "utfort") return "🟠";
    if (s === "pagar") return "🟡";
    return "⬜";
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("kontrollplan.rediger")}</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="text-sm">
            <div className="font-medium">
              {punkt.sjekklisteMal.prefix ? `${punkt.sjekklisteMal.prefix} — ` : ""}
              {punkt.sjekklisteMal.name}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {punkt.omrade?.navn ?? "—"} · {punkt.faggruppe.name}
            </div>
            {/* Bytt mal */}
            {punkt.status === "planlagt" && (
              !visByttMal ? (
                <button type="button" onClick={() => setVisByttMal(true)} className="text-[10px] text-sitedoc-secondary hover:underline mt-1">
                  {t("kontrollplan.byttMal")}
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={nyMalId}
                    onChange={(e) => setNyMalId(e.target.value)}
                    className="flex-1 border rounded px-2 py-1 text-xs"
                  >
                    <option value="">—</option>
                    {maler?.filter((m: { category: string; id: string }) => m.category === "sjekkliste" && m.id !== punkt.sjekklisteMalId)
                      .map((m: { id: string; name: string }) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={() => { if (nyMalId) oppdaterPunkt.mutate({ punktId: punkt.id, sjekklisteMalId: nyMalId }); }}
                    disabled={!nyMalId || oppdaterPunkt.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("handling.lagre")}
                  </button>
                </div>
              )
            )}
          </div>

          {/* Tilstand — READ-ONLY avledet (fremdrift × frist), samme som liste/rutenett/
              tegning. Den gamle manuelle status-knapperaden (planlagt/pågår/utført/
              godkjent) er FJERNET: `punkt.status` er pensjonert fra UI, og en manuell
              setter ville latt brukeren sette en status som ikke vises noe sted.
              Tilstanden endres nå kun av faktisk arbeid (kobling/Start → sjekklistestatus). */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.status")}</label>
            <TilstandMerke visning={avledPunktTilstand(punkt, isoUkeRef(new Date()))} />
          </div>

          {/* Sjekkliste — start (oppretter sjekkliste via vanlig dokumentflyt) / koble / åpne */}
          {renderHandling && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.sjekklisteKolonne")}</label>
              {renderHandling(punkt)}
            </div>
          )}

          {/* L1.5: forhåndsvalgt dokumentflyt (admin) — gjør Start uavhengig av hvem som trykker */}
          <FlytSeksjon punkt={punkt} allePunkter={allePunkter} projectId={projectId} onOppdatert={onOppdatert} />

          {/* L2: plassering på tegning */}
          <TegningSeksjon punkt={punkt} projectId={projectId} onOppdatert={onOppdatert} onLukk={onLukk} />

          {/* Frist */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.frist")}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <UkeVelger
                  uke={fristUke}
                  aar={fristAar}
                  onChange={(u, a) => { setFristUke(u || null); setFristAar(a || null); }}
                  placeholder={t("kontrollplan.frist") + "..."}
                />
              </div>
              <button
                onClick={handleLagreFrist}
                disabled={oppdaterPunkt.isPending}
                className="mt-4 px-2 py-1 text-xs bg-sitedoc-primary text-white rounded disabled:opacity-50"
              >
                {t("handling.lagre")}
              </button>
            </div>
            {/* Kaskade-fristflytting */}
            {!visKaskade ? (
              <button type="button" onClick={() => setVisKaskade(true)} className="text-[10px] text-sitedoc-secondary hover:underline mt-1">
                Skyv med avhengigheter (kaskade)
              </button>
            ) : (
              <div className="mt-2 border rounded p-2 bg-gray-50 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={kaskadeUker}
                    onChange={(e) => setKaskadeUker(Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1 text-xs"
                  />
                  <span className="text-xs text-gray-500">{t("kontrollplan.skyvUker")}</span>
                </div>
                {kaskadeBerort && kaskadeBerort.length > 0 ? (
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p className="font-medium">Berørte punkter ({kaskadeBerort.length}):</p>
                    {kaskadeBerort.map((b) => (
                      <div key={b.id}>• {b.omradeNavn} × {b.malNavn} {b.fristUke ? `U${b.fristUke} → U${b.fristUke + kaskadeUker}` : ""}</div>
                    ))}
                  </div>
                ) : kaskadeBerort ? (
                  <p className="text-[10px] text-gray-400">Ingen nedstrøms avhengigheter</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    onClick={() => skyvKaskade.mutate({ punktId: punkt.id, antallUker: kaskadeUker })}
                    disabled={kaskadeUker === 0 || skyvKaskade.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("kontrollplan.skyvBekreft", { antall: (kaskadeBerort?.length ?? 0) + 1 })}
                  </button>
                  <button onClick={() => setVisKaskade(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Avhengighet */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.avhengighet")}</label>
            <select
              value={avhengerAvId}
              onChange={(e) => setAvhengerAvId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">{t("kontrollplan.ingenAvhengighet")}</option>
              {[...avhengighetsKandidater.entries()].map(([omradeNavn, punkter]) => (
                <optgroup key={omradeNavn} label={omradeNavn}>
                  {punkter.map((p) => (
                    <option key={p.id} value={p.id}>
                      {statusIkon(p.status)} {p.sjekklisteMal.name}
                      {p.fristUke ? ` — U${p.fristUke}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {avhengerAvId !== (punkt.avhengerAvId ?? "") && (
              <button
                onClick={handleLagreAvhengighet}
                disabled={oppdaterPunkt.isPending}
                className="mt-1 px-2 py-1 text-xs bg-sitedoc-primary text-white rounded disabled:opacity-50"
              >
                {t("handling.lagre")}
              </button>
            )}
          </div>

          {/* Skyv område */}
          {punkt.omradeId && (
            <div>
              {!visSkyvOmrade ? (
                <button
                  type="button"
                  onClick={() => setVisSkyvOmrade(true)}
                  className="text-xs text-sitedoc-secondary hover:underline"
                >
                  {t("kontrollplan.skyvOmrade")} ({punkt.omrade?.navn})
                </button>
              ) : (
                <div className="border rounded p-2 bg-gray-50 space-y-2">
                  <label className="text-xs font-medium text-gray-600 block">
                    {t("kontrollplan.skyvOmrade")}: {punkt.omrade?.navn}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={skyvUker}
                      onChange={(e) => setSkyvUker(Number(e.target.value))}
                      className="w-20 border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-500">{t("kontrollplan.skyvUker")}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => skyvOmrade.mutate({ kontrollplanId: punkt.kontrollplanId, omradeId: punkt.omradeId!, antallUker: skyvUker })}
                      disabled={skyvUker === 0 || skyvOmrade.isPending}
                      className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                    >
                      {t("kontrollplan.skyvBekreft", { antall: punkterISammeOmrade })}
                    </button>
                    <button onClick={() => setVisSkyvOmrade(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                      {t("handling.avbryt")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Historikk */}
          <HistorikkSeksjon punktId={punkt.id} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          {punkt.status === "planlagt" ? (
            <button
              onClick={() => slettPunkt.mutate({ punktId: punkt.id })}
              disabled={slettPunkt.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {t("kontrollplan.slettPunkt")}
            </button>
          ) : (
            <div />
          )}
          <button onClick={onLukk} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            {t("handling.lukk")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* L1.5: forhåndsvalgt dokumentflyt på punktet. Admin-only (settingen ER autorisasjonen
 * for registrator-bypass ved Start, så den må kreve mer enn medlemskap). Velger + bulk
 * «sett for alle punkter med denne malen» — det reelle tilfellet fra fremdriftsplan-import. */
function FlytSeksjon({
  punkt,
  allePunkter,
  projectId,
  onOppdatert,
}: {
  punkt: Punkt;
  allePunkter: Punkt[];
  projectId: string;
  onOppdatert: () => void;
}) {
  const { t } = useTranslation();
  const { data: kanRedigere } = trpc.mal.kanRedigere.useQuery({ projectId });
  // L1.6 (Kenneth): er punktet startet (koblet sjekkliste), er flyten låst til den flyten
  // sjekklisten faktisk ligger i. Å endre punktets preset ville ikke flytte det eksisterende
  // dokumentet — feltet ville vist en flyt dokumentet ikke er i. Da vises sjekklistens
  // faktiske flyt read-only. Samme ærlighetsprinsipp som at fremdriften avledes fra
  // sjekklisten, ikke fra punkt.status. Velgeren (+ kandidat-query) trengs kun ukoblet.
  const erKoblet = punkt.sjekkliste != null;
  const { data: flyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId },
    { enabled: kanRedigere === true && !erKoblet },
  );
  const [valgt, setValgt] = useState(punkt.dokumentflytId ?? "");
  const [bulkResultat, setBulkResultat] = useState<{ oppdatert: number; hoppetOver: number } | null>(null);

  const settPunktFlyt = trpc.kontrollplan.settPunktFlyt.useMutation({ onSuccess: () => onOppdatert() });
  const settFlytForMal = trpc.kontrollplan.settFlytForMal.useMutation({
    onSuccess: (r: { oppdatert: number; hoppetOver: number }) => { setBulkResultat(r); onOppdatert(); },
  });

  // Kandidatflyter: flyter som inneholder punktets mal OG har eier-faggruppe (bestiller
  // utledes fra den ved Start). Uten eier-faggruppe kan flyten ikke forhåndsvelges.
  const kandidater = useMemo(
    () =>
      (flyter ?? []).filter(
        (f: { faggruppe: { id: string } | null; maler: Array<{ template: { id: string } }> }) =>
          f.faggruppe != null && f.maler.some((m) => m.template.id === punkt.sjekklisteMalId),
      ),
    [flyter, punkt.sjekklisteMalId],
  );

  // Bulk-forhåndsvisning fra allerede-lastede punkter (cowork-krav: si hva den treffer
  // FØR den kjører, og ikke overskriv bevisste valg stille).
  const sammeMal = allePunkter.filter((p) => p.sjekklisteMalId === punkt.sjekklisteMalId);
  const hoppesOver = valgt ? sammeMal.filter((p) => p.dokumentflytId && p.dokumentflytId !== valgt).length : 0;

  if (kanRedigere !== true) return null;

  // Koblet punkt: flyten er låst. Vis den flyten sjekklisten FAKTISK ligger i, read-only.
  if (erKoblet) {
    return (
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.forhaandsvalgtFlyt")}</label>
        <div className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600">
          {punkt.sjekkliste?.dokumentflyt?.name ?? "—"}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{t("kontrollplan.flytLaastEtterStart")}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.forhaandsvalgtFlyt")}</label>
      <p className="text-[10px] text-gray-400 mb-1.5">{t("kontrollplan.forhaandsvalgtFlytHjelp")}</p>
      <select
        value={valgt}
        onChange={(e) => {
          const ny = e.target.value;
          setValgt(ny);
          setBulkResultat(null);
          settPunktFlyt.mutate({ punktId: punkt.id, dokumentflytId: ny || null });
        }}
        disabled={settPunktFlyt.isPending}
        className="w-full border rounded px-2 py-1.5 text-sm"
      >
        <option value="">{t("kontrollplan.flytIngenBrukRegistrator")}</option>
        {kandidater.map((f: { id: string; name: string; faggruppe: { name: string } | null }) => (
          <option key={f.id} value={f.id}>
            {f.name}{f.faggruppe ? ` — ${f.faggruppe.name}` : ""}
          </option>
        ))}
      </select>

      {/* Bulk: sett samme flyt på alle punkter med denne malen (kun når en flyt er valgt
          og det finnes mer enn ett punkt med malen). */}
      {valgt && sammeMal.length > 1 && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() =>
              settFlytForMal.mutate({
                kontrollplanId: punkt.kontrollplanId,
                sjekklisteMalId: punkt.sjekklisteMalId,
                dokumentflytId: valgt,
              })
            }
            disabled={settFlytForMal.isPending}
            className="text-[11px] text-sitedoc-secondary hover:underline disabled:opacity-50"
          >
            {t("kontrollplan.settFlytForAlle", { antall: sammeMal.length, mal: punkt.sjekklisteMal.name })}
          </button>
          {hoppesOver > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">{t("kontrollplan.settFlytHoppesOver", { antall: hoppesOver })}</p>
          )}
        </div>
      )}
      {bulkResultat && (
        <p className="text-[10px] text-green-600 mt-1">
          {t("kontrollplan.settFlytResultat", { oppdatert: bulkResultat.oppdatert, hoppetOver: bulkResultat.hoppetOver })}
        </p>
      )}
    </div>
  );
}

/* L2: plassering av punktet på en tegning. «Plasser» starter den delte posisjonsvelger-
 * flyten (samme som TegningPosisjonObjekt): lukker dialogen, navigerer til tegningssiden,
 * bruker klikker → kontrollplan-siden fanger resultatet ved retur og lagrer. «Vis på
 * tegning» setter aktiv tegning + hopper dit med markøren uthevet (?marker). */
function TegningSeksjon({
  punkt,
  projectId,
  onOppdatert,
  onLukk,
}: {
  punkt: Punkt;
  projectId: string;
  onOppdatert: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { startPosisjonsvelger, settAktivTegning } = useByggeplass();
  const settPlassering = trpc.kontrollplan.settPunktPlassering.useMutation({ onSuccess: () => onOppdatert() });

  function plasser() {
    // Kontrollplan-siden henter resultatet ved retur (hentOgTømPosisjonsResultat).
    startPosisjonsvelger(punkt.id);
    onLukk();
    router.push(`/dashbord/${projectId}/tegninger`);
  }
  function vis() {
    if (!punkt.drawing) return;
    settAktivTegning({ id: punkt.drawing.id, name: punkt.drawing.name });
    onLukk();
    router.push(`/dashbord/${projectId}/tegninger?marker=${punkt.id}`);
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.tegningsplassering")}</label>
      {punkt.drawingId && punkt.drawing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-gray-700">
            <MapPin className="h-4 w-4 text-sitedoc-secondary" />
            {punkt.drawing.name}
          </span>
          <button type="button" onClick={vis} className="text-xs text-sitedoc-secondary hover:underline">
            {t("kontrollplan.visPaTegning")}
          </button>
          <button type="button" onClick={plasser} className="text-xs text-gray-500 hover:underline">
            {t("kontrollplan.endrePlassering")}
          </button>
          <button
            type="button"
            onClick={() => settPlassering.mutate({ punktId: punkt.id, drawingId: null, positionX: null, positionY: null })}
            disabled={settPlassering.isPending}
            className="text-xs text-gray-400 hover:text-sitedoc-error disabled:opacity-50"
          >
            {t("handling.fjern")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={plasser}
          className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-sitedoc-secondary hover:bg-blue-50/50 hover:text-sitedoc-secondary"
        >
          <Target className="h-4 w-4" />
          {t("kontrollplan.plasserPaTegning")}
        </button>
      )}
    </div>
  );
}

/* Historikk-seksjon med lazy loading */
function HistorikkSeksjon({ punktId }: { punktId: string }) {
  const { t } = useTranslation();
  const [aapen, setAapen] = useState(false);
  const { data: historikk } = trpc.kontrollplan.hentHistorikk.useQuery(
    { punktId },
    { enabled: aapen },
  );

  const handlingLabel: Record<string, string> = {
    opprettet: "Opprettet",
    startet: "Startet",
    utfort: "Utført",
    godkjent: "Godkjent",
    avvist: "Avvist",
    endret: "Endret",
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setAapen(!aapen)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        {aapen ? "▾" : "▸"} Historikk
      </button>
      {aapen && historikk && (
        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
          {historikk.length === 0 && (
            <p className="text-[10px] text-gray-400">Ingen historikk</p>
          )}
          {historikk.map((h) => (
            <div key={h.id} className="flex items-baseline gap-2 text-[10px] text-gray-500">
              <span className="text-gray-400 flex-shrink-0">
                {new Date(h.tidspunkt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" })}
                {" "}
                {new Date(h.tidspunkt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="font-medium text-gray-600">{h.bruker.name ?? "—"}</span>
              <span>{handlingLabel[h.handling] ?? h.handling}</span>
              {h.kommentar && <span className="text-gray-400 truncate">— {h.kommentar}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
