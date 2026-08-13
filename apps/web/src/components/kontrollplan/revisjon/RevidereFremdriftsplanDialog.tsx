"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { X, Upload, FileText, Loader2, Check, ChevronRight, ChevronDown } from "lucide-react";
import { parseMSProjectXML } from "@/lib/ms-project-parser";
import type { MSProjectData } from "@/lib/ms-project-parser";
import { useImportTilordning } from "../importTilordning/useImportTilordning";
import {
  beregnRevisjonsdiff,
  formaterFristEndring,
  type RevisjonPunkt,
  type HoppetOverRad,
} from "./beregnRevisjonsdiff";

interface RevidereFremdriftsplanDialogProps {
  kontrollplanId: string;
  projectId: string;
  byggeplassId: string;
  planNavn: string;
  onLukk: () => void;
  onAnvendt: () => void;
}

/**
 * Revisjons-diff (del 2): les en oppdatert fremdriftsplan og vis endringene mot
 * eksisterende kontrollpunkter — frist-endringer (per milepæl), nye aktiviteter,
 * deaktiverte. Mal/faggruppe for nye aktiviteter gjenbruker useImportTilordning
 * (del 1.5) slik at tilordningen ikke drifter fra import-flyten.
 */
export function RevidereFremdriftsplanDialog({
  kontrollplanId,
  projectId,
  byggeplassId: _byggeplassId,
  planNavn,
  onLukk,
  onAnvendt,
}: RevidereFremdriftsplanDialogProps) {
  const { t } = useTranslation();

  const [fil, setFil] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MSProjectData | null>(null);
  const [parseFeil, setParseFeil] = useState<string | null>(null);
  const [parser, setParser] = useState(false);
  const [dragAktiv, setDragAktiv] = useState(false);

  const [sok, setSok] = useState("");
  const [visUendret, setVisUendret] = useState(false);
  const [apneMilepeler, setApneMilepeler] = useState<Set<string>>(new Set());
  const [visValgtBort, setVisValgtBort] = useState(false);

  // Lokalt utvalg
  const [avvalgteSikre, setAvvalgteSikre] = useState<Set<string>>(new Set()); // sikre er valgt som default
  const [bekreftedeAntatt, setBekreftedeAntatt] = useState<Set<string>>(new Set());
  const [arkiverUids, setArkiverUids] = useState<Set<number>>(new Set());
  const [valgteNye, setValgteNye] = useState<Set<number>>(new Set());
  const [anvendFeil, setAnvendFeil] = useState(false);

  const grunnlag = trpc.kontrollplan.hentRevisjonsgrunnlag.useQuery(
    { kontrollplanId },
    { enabled: parsedData !== null },
  );
  const anvend = trpc.kontrollplan.anvendRevisjon.useMutation();

  const diff = useMemo(() => {
    if (!parsedData || !grunnlag.data) return null;
    const hoppetOver: HoppetOverRad[] = grunnlag.data.sisteImport?.hoppetOver ?? [];
    return beregnRevisjonsdiff(
      grunnlag.data.punkter as RevisjonPunkt[],
      parsedData.flatTasks,
      hoppetOver,
    );
  }, [parsedData, grunnlag.data]);

  // Nye aktiviteter: gjenbruk import-tilordningen (mal + ressurs→faggruppe) for
  // hele kandidatsettet, slik at logikken deles med import-flyten (del 1.5).
  const nyeUidsSet = useMemo(
    () => new Set((diff?.nyeAktiviteter ?? []).filter((n) => !n.tidligereValgtBort).map((n) => n.uid)),
    [diff],
  );
  const tilordning = useImportTilordning({ projectId, parsedData, selectedUIDs: nyeUidsSet, stegNr: 3 });
  const initGjort = useRef(false);
  useEffect(() => {
    if (!initGjort.current && tilordning.faggrupper && nyeUidsSet.size > 0) {
      tilordning.initSteg2(); // auto-match ressurs → faggruppe én gang
      initGjort.current = true;
    }
  }, [tilordning.faggrupper, tilordning.initSteg2, nyeUidsSet]);

  const faggruppeForNy = useCallback((resourceNames: string[]) => {
    for (const r of resourceNames) {
      const fgId = tilordning.ressursFaggruppeMap.get(r);
      if (fgId) return (tilordning.faggrupper ?? []).find((f: { id: string }) => f.id === fgId) ?? null;
    }
    return null;
  }, [tilordning.ressursFaggruppeMap, tilordning.faggrupper]);

  const handleFilValgt = useCallback(async (file: File) => {
    setFil(file);
    setParseFeil(null);
    setParser(true);
    try {
      const data = await parseMSProjectXML(await file.text());
      setParsedData(data);
    } catch (e) {
      setParseFeil(e instanceof Error ? e.message : t("kontrollplan.importUgyldigFil"));
      setParsedData(null);
    } finally {
      setParser(false);
    }
  }, [t]);

  const harUanvendteValg = parsedData !== null;
  const handleLukk = useCallback(() => {
    if (harUanvendteValg && !window.confirm(t("kontrollplan.revisjonForkast"))) return;
    onLukk();
  }, [harUanvendteValg, onLukk, t]);

  const toggleMilepel = useCallback((key: string) => {
    setApneMilepeler((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Antall til bunnlinja
  const oppsummering = useMemo(() => {
    if (!diff) return null;
    const fristerOppdateres = diff.fristEndringer.flatMap((g) => g.endringer)
      .filter((e) => e.sikker ? !avvalgteSikre.has(e.punkt.id) : bekreftedeAntatt.has(e.punkt.id)).length;
    const ubekreftetAntatt = diff.antallAntatt
      - diff.fristEndringer.flatMap((g) => g.endringer).filter((e) => !e.sikker && bekreftedeAntatt.has(e.punkt.id)).length;
    return { fristerOppdateres, ubekreftetAntatt, arkiveres: arkiverUids.size };
  }, [diff, avvalgteSikre, bekreftedeAntatt, arkiverUids]);

  const sokTreff = useCallback((navn: string, wbs: string | null, mal?: string) => {
    if (!sok.trim()) return true;
    const s = sok.toLowerCase();
    return navn.toLowerCase().includes(s)
      || (wbs ?? "").toLowerCase().includes(s)
      || (mal ?? "").toLowerCase().includes(s);
  }, [sok]);

  const malEtikett = (p: RevisjonPunkt) =>
    `${p.sjekklisteMal.prefix ? p.sjekklisteMal.prefix + " — " : ""}${p.sjekklisteMal.name}`;

  // Nye punkter klare til opprettelse: valgt + har mal + faggruppe løst.
  const nyeKlare = useMemo(
    () => tilordning.importPunkter.filter((p) => valgteNye.has(p.taskUid) && p.faggruppeId),
    [tilordning.importPunkter, valgteNye],
  );

  const kanAnvende = !!oppsummering
    && (oppsummering.fristerOppdateres > 0 || nyeKlare.length > 0 || arkiverUids.size > 0);

  const handleAnvend = useCallback(async () => {
    if (!diff) return;
    setAnvendFeil(false);
    const alleEndringer = diff.fristEndringer.flatMap((g) => g.endringer);

    // Levende identitet: alle sikre UID-matcher + bekreftede antatt-samme.
    const identitetsOppdateringer = [
      ...diff.identiteter,
      ...alleEndringer
        .filter((e) => !e.sikker && bekreftedeAntatt.has(e.punkt.id))
        .map((e) => ({ punktId: e.punkt.id, nyImportTaskUid: e.nyTaskUid, nyImportNavn: e.nyImportNavn })),
    ];
    // Frist: valgte sikre (ikke avvalgt) + bekreftede antatt.
    const fristOppdateringer = alleEndringer
      .filter((e) => (e.sikker ? !avvalgteSikre.has(e.punkt.id) : bekreftedeAntatt.has(e.punkt.id)))
      .map((e) => ({ punktId: e.punkt.id, nyFristUke: e.nyFrist?.uke ?? null, nyFristAar: e.nyFrist?.aar ?? null }));
    const nyePunkter = nyeKlare.map((p) => ({
      sjekklisteMalId: p.malId,
      faggruppeId: p.faggruppeId!,
      importTaskUid: p.taskUid,
      importWbs: p.wbs,
      importNavn: p.name,
      fristUke: p.frist?.uke ?? null,
      fristAar: p.frist?.aar ?? null,
    }));
    const arkiverPunktIds = diff.deaktiverte
      .filter((d) => arkiverUids.has(d.uid))
      .flatMap((d) => d.punkter.map((p) => p.id));
    // Kandidat-nye som ikke tas inn — vist men fravalgt → hoppetOver for neste revisjon.
    const hoppetOver = diff.nyeAktiviteter
      .filter((n) => !n.tidligereValgtBort && !valgteNye.has(n.uid))
      .map((n) => ({ uid: n.uid, navn: n.navn, wbs: n.wbs }));

    try {
      await anvend.mutateAsync({
        kontrollplanId,
        filnavn: fil?.name ?? "ukjent",
        antallParsedeRader: parsedData?.flatTasks.length ?? 0,
        identitetsOppdateringer,
        fristOppdateringer,
        nyePunkter,
        arkiverPunktIds,
        hoppetOver,
      });
      onAnvendt();
      onLukk();
    } catch {
      setAnvendFeil(true);
    }
  }, [diff, bekreftedeAntatt, avvalgteSikre, nyeKlare, arkiverUids, valgteNye, anvend, kontrollplanId, fil, parsedData, onAnvendt, onLukk]);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b">
          <div>
            <div className="text-lg font-bold text-gray-900">{t("kontrollplan.revisjonTittel")}</div>
            <div className="text-[13px] text-gray-500 mt-0.5">
              {fil?.name
                ? t("kontrollplan.revisjonMeta", {
                    fil: fil.name,
                    antall: parsedData?.flatTasks.length ?? 0,
                    forrige: grunnlag.data?.sisteImport?.filnavn ?? "—",
                  })
                : t("kontrollplan.revisjonVelgFil")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3.5 py-2">{planNavn}</span>
            <button onClick={handleLukk} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filfase */}
        {!parsedData && (
          <div className="flex-1 overflow-y-auto p-7">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragAktiv(true); }}
              onDragLeave={() => setDragAktiv(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragAktiv(false);
                const f = e.dataTransfer.files[0];
                if (f && f.name.toLowerCase().endsWith(".xml")) handleFilValgt(f);
                else setParseFeil(t("kontrollplan.importUgyldigFil"));
              }}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                dragAktiv ? "border-sitedoc-primary bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {parser ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> {t("kontrollplan.importParser")}
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    {t("kontrollplan.importDraSlipp")},{" "}
                    <label className="cursor-pointer text-sitedoc-primary hover:underline">
                      {t("kontrollplan.importEllerVelg")}
                      <input type="file" className="hidden" accept=".xml"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilValgt(f); }} />
                    </label>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">MS Project XML (.xml)</div>
                  {parseFeil && <div className="mt-3 text-sm text-red-600">{parseFeil}</div>}
                </>
              )}
            </div>
          </div>
        )}

        {/* Diff-fase */}
        {parsedData && (
          <>
            {grunnlag.isLoading || !diff ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> {t("kontrollplan.revisjonBeregner")}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Filter-bar */}
                <div className="flex items-center gap-3 px-7 py-3.5 border-b">
                  <input value={sok} onChange={(e) => setSok(e.target.value)}
                    placeholder={t("kontrollplan.revisjonSok")}
                    className="flex-none w-72 border rounded-lg px-3 py-1.5 text-[13px]" />
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="text-sitedoc-primary bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
                      {t("kontrollplan.revisjonFristEndringer")} {diff.fristEndringer.reduce((n, g) => n + g.endringer.length, 0)}
                    </span>
                    <span className="text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                      {t("kontrollplan.revisjonNye")} {diff.nyeAktiviteter.filter((n) => !n.tidligereValgtBort).length}
                    </span>
                    <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                      {t("kontrollplan.revisjonDeaktiverte")} {diff.deaktiverte.length}
                    </span>
                    <span className="text-gray-500 bg-gray-50 border rounded-full px-3 py-1">
                      {t("kontrollplan.revisjonUendret")} {diff.uendretAntall}
                    </span>
                  </div>
                  <label className="ml-auto flex items-center gap-2 text-[13px] text-gray-500">
                    <input type="checkbox" checked={visUendret} onChange={(e) => setVisUendret(e.target.checked)} />
                    {t("kontrollplan.revisjonVisUendret")}
                  </label>
                </div>

                {/* Utført/godkjent-oppsummering */}
                {diff.utfortGodkjentPunkter.length > 0 && (
                  <div className="flex items-center gap-2 px-7 py-2.5 bg-green-50/50 border-b text-[12.5px] text-gray-700">
                    <Check className="h-3.5 w-3.5 text-green-700" />
                    {t("kontrollplan.revisjonUtfortHoldesUte", { antall: diff.utfortGodkjentPunkter.length })}
                  </div>
                )}

                {/* Frist-endringer per milepæl */}
                <div className="px-7 pt-5 pb-2">
                  <div className="text-[11px] tracking-wider uppercase text-sitedoc-primary font-bold">
                    {t("kontrollplan.revisjonFristEndringer")}
                    <span className="text-gray-400 font-medium normal-case tracking-normal"> — {t("kontrollplan.revisjonFristEndringerHint")}</span>
                  </div>
                </div>
                {diff.fristEndringer.map((gruppe, gi) => {
                  const key = gruppe.milepelId ?? "__ingen__";
                  const apen = gi === 0 || apneMilepeler.has(key);
                  const synlige = gruppe.endringer.filter((e) => sokTreff(e.punkt.importNavn ?? "", e.punkt.importWbs, malEtikett(e.punkt)));
                  if (synlige.length === 0) return null;
                  return (
                    <div key={key} className="mx-7 mb-2.5 border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b cursor-pointer"
                        onClick={() => toggleMilepel(key)}>
                        {apen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        <span className="text-[13px] font-bold text-gray-900">
                          {t("kontrollplan.milepel")}: {gruppe.milepelNavn ?? t("kontrollplan.revisjonIngenMilepael")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {t("kontrollplan.revisjonAntallEndringer", { antall: gruppe.endringer.length })}
                          {gruppe.antallAntatt > 0 && ` · ${t("kontrollplan.revisjonAntallAntatt", { antall: gruppe.antallAntatt })}`}
                        </span>
                        {gruppe.antallSikre > 0 && (
                          <label className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-sitedoc-primary"
                            onClick={(ev) => ev.stopPropagation()}>
                            <input type="checkbox"
                              checked={gruppe.endringer.filter((e) => e.sikker).every((e) => !avvalgteSikre.has(e.punkt.id))}
                              onChange={(ev) => {
                                const sikreIds = gruppe.endringer.filter((e) => e.sikker).map((e) => e.punkt.id);
                                setAvvalgteSikre((prev) => {
                                  const next = new Set(prev);
                                  if (ev.target.checked) sikreIds.forEach((id) => next.delete(id));
                                  else sikreIds.forEach((id) => next.add(id));
                                  return next;
                                });
                              }} />
                            {t("kontrollplan.revisjonVelgAlleSikre", { antall: gruppe.antallSikre })}
                          </label>
                        )}
                      </div>
                      {apen && synlige.map((e) => (
                        <div key={e.punkt.id}
                          className={`grid grid-cols-[36px_1fr_140px_90px_160px] gap-x-3 items-center px-4 py-2.5 border-b last:border-b-0 ${
                            e.sikker ? "" : "bg-amber-50/40"
                          }`}>
                          {e.sikker ? (
                            <input type="checkbox" checked={!avvalgteSikre.has(e.punkt.id)}
                              onChange={() => setAvvalgteSikre((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.punkt.id)) next.delete(e.punkt.id); else next.add(e.punkt.id);
                                return next;
                              })} />
                          ) : (
                            <button
                              onClick={() => setBekreftedeAntatt((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.punkt.id)) next.delete(e.punkt.id); else next.add(e.punkt.id);
                                return next;
                              })}
                              className={`text-[11px] font-bold rounded px-1.5 py-1 border ${
                                bekreftedeAntatt.has(e.punkt.id)
                                  ? "bg-amber-500 text-white border-amber-500"
                                  : "bg-white text-amber-800 border-amber-400"
                              }`}>
                              {bekreftedeAntatt.has(e.punkt.id) ? t("kontrollplan.revisjonBekreftet") : t("kontrollplan.revisjonBekreft")}
                            </button>
                          )}
                          <div>
                            <span className="text-[13.5px] text-gray-900 font-medium">{e.punkt.importNavn ?? "—"}</span>
                            <span className="text-[11.5px] text-gray-400 ml-1.5">{malEtikett(e.punkt)}</span>
                            {!e.sikker && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {t("kontrollplan.revisjonAntattVar", { navn: e.antattVar ?? "—" })}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-0.5 justify-self-start">
                            {e.punkt.sjekklisteMal.kontrollomrade ?? "—"}
                          </span>
                          <span className="text-xs text-gray-400">WBS {e.punkt.importWbs ?? "—"}</span>
                          <span className="text-[13px] text-gray-900 justify-self-end tabular-nums">
                            {formaterFristEndring(e.gammelFrist, e.nyFrist)}
                            {e.deltaUker != null && e.deltaUker !== 0 && (
                              <span className="text-amber-700 text-[11.5px] ml-1">
                                {e.deltaUker > 0 ? "+" : ""}{e.deltaUker} {t("kontrollplan.revisjonUker")}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Nye aktiviteter (mal-tilordning + anvend kommer i c) */}
                <div className="px-7 pt-4 pb-2">
                  <div className="text-[11px] tracking-wider uppercase text-green-700 font-bold">
                    {t("kontrollplan.revisjonNye")}
                    <span className="text-gray-400 font-medium normal-case tracking-normal"> — {t("kontrollplan.revisjonNyeHint")}</span>
                  </div>
                </div>
                <div className="mx-7 mb-2.5 border rounded-lg overflow-hidden">
                  {diff.nyeAktiviteter.filter((n) => !n.tidligereValgtBort && sokTreff(n.navn, n.wbs)).map((n) => {
                    const fg = faggruppeForNy(n.resourceNames);
                    return (
                    <div key={n.uid} className="grid grid-cols-[36px_1fr_200px_150px] gap-x-3 items-center px-4 py-2.5 border-b last:border-b-0">
                      <input type="checkbox" checked={valgteNye.has(n.uid)}
                        onChange={() => setValgteNye((prev) => {
                          const s = new Set(prev);
                          if (s.has(n.uid)) s.delete(n.uid); else s.add(n.uid);
                          return s;
                        })} />
                      <div>
                        <span className="text-[13.5px] text-gray-900 font-medium">{n.navn}</span>
                        <div className="text-[11.5px] text-gray-400">
                          WBS {n.wbs ?? "—"}{n.frist ? ` · ${t("kontrollplan.revisjonFristUke", { uke: n.frist.uke })}` : ""}
                          {n.resourceNames.length > 0 ? ` · ${n.resourceNames.join(", ")}` : ""}
                        </div>
                      </div>
                      <select
                        value={tilordning.oppgaveMalMap.get(n.uid) ?? ""}
                        onChange={(e) => tilordning.setOppgaveMalMap((prev) => {
                          const m = new Map(prev);
                          if (e.target.value) m.set(n.uid, e.target.value); else m.delete(n.uid);
                          return m;
                        })}
                        className="border rounded-lg px-2.5 py-1.5 text-[12.5px] text-gray-900"
                      >
                        <option value="">{t("kontrollplan.sjekklisteMal")} …</option>
                        {tilordning.alleMaler.map((m) => (
                          <option key={m.id} value={m.id}>{m.prefix ? `${m.prefix} — ` : ""}{m.name}</option>
                        ))}
                      </select>
                      {fg ? (
                        <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-0.5 justify-self-start">{fg.name}</span>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 justify-self-start">
                          {t("kontrollplan.revisjonManglerFaggruppe")}
                        </span>
                      )}
                    </div>
                    );
                  })}
                  {diff.nyeAktiviteter.some((n) => n.tidligereValgtBort) && (
                    <div className="px-4 py-2 text-[12.5px] text-gray-500 bg-gray-50 cursor-pointer"
                      onClick={() => setVisValgtBort((v) => !v)}>
                      ▸ {t("kontrollplan.revisjonTidligereValgtBort", { antall: diff.nyeAktiviteter.filter((n) => n.tidligereValgtBort).length })}
                    </div>
                  )}
                  {visValgtBort && diff.nyeAktiviteter.filter((n) => n.tidligereValgtBort).map((n) => (
                    <div key={n.uid} className="px-4 py-2 border-t text-[12.5px] text-gray-400">
                      {n.navn} · WBS {n.wbs ?? "—"}
                    </div>
                  ))}
                </div>

                {/* Deaktiverte */}
                <div className="px-7 pt-4 pb-2">
                  <div className="text-[11px] tracking-wider uppercase text-amber-700 font-bold">
                    {t("kontrollplan.revisjonDeaktiverte")}
                    <span className="text-gray-400 font-medium normal-case tracking-normal"> — {t("kontrollplan.revisjonDeaktiverteHint")}</span>
                  </div>
                </div>
                <div className="mx-7 mb-24 border border-amber-200 bg-amber-50/40 rounded-lg overflow-hidden">
                  {diff.deaktiverte.filter((d) => sokTreff(d.navn ?? "", d.wbs)).map((d) => (
                    <div key={d.uid} className="grid grid-cols-[1fr_200px] gap-x-3 items-center px-4 py-2.5 border-b border-amber-100 last:border-b-0">
                      <div>
                        <span className="text-[13.5px] text-gray-900 font-medium">{d.navn ?? "—"}</span>
                        <div className="text-[11.5px] text-gray-400">
                          WBS {d.wbs ?? "—"} · {t("kontrollplan.revisjonIngenMatch")}
                          {d.harUtfortArbeid && ` · ${t("kontrollplan.revisjonHarArbeid")}`}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-self-end">
                        <button
                          onClick={() => setArkiverUids((prev) => { const n = new Set(prev); n.delete(d.uid); return n; })}
                          className={`border rounded-lg px-3 py-1 text-xs font-semibold ${
                            !arkiverUids.has(d.uid) ? "bg-white border-sitedoc-primary text-sitedoc-primary" : "bg-white border-gray-300 text-gray-600"
                          }`}>
                          {t("kontrollplan.revisjonBeholdPunkt")}
                        </button>
                        <button
                          disabled={d.harUtfortArbeid}
                          onClick={() => setArkiverUids((prev) => { const n = new Set(prev); n.add(d.uid); return n; })}
                          title={d.harUtfortArbeid ? t("kontrollplan.revisjonHarArbeid") : undefined}
                          className={`border rounded-lg px-3 py-1 text-xs font-semibold disabled:bg-gray-50 disabled:text-gray-300 ${
                            arkiverUids.has(d.uid) ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-amber-400 text-amber-800"
                          }`}>
                          {t("kontrollplan.revisjonArkiver")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sticky footer */}
            <div className="flex items-center gap-4 px-7 py-3.5 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
              {oppsummering && (
                <div className="text-[13px] text-gray-700">
                  {t("kontrollplan.revisjonBunnlinje", {
                    frister: oppsummering.fristerOppdateres,
                    arkiv: oppsummering.arkiveres,
                  })}
                  {oppsummering.ubekreftetAntatt > 0 && (
                    <div className="text-[12px] text-amber-700 mt-0.5">
                      {t("kontrollplan.revisjonUbekreftet", { antall: oppsummering.ubekreftetAntatt })}
                    </div>
                  )}
                  {anvendFeil && (
                    <div className="text-[12px] text-red-600 mt-0.5">{t("kontrollplan.revisjonFeil")}</div>
                  )}
                </div>
              )}
              <div className="ml-auto flex gap-2.5">
                <button onClick={handleLukk} className="border rounded-lg px-4 py-2 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50">
                  {t("handling.avbryt")}
                </button>
                <button
                  onClick={handleAnvend}
                  disabled={!kanAnvende || anvend.isPending}
                  className="flex items-center gap-2 border-none bg-sitedoc-primary text-white rounded-lg px-5 py-2 text-[13.5px] font-bold disabled:opacity-50"
                >
                  {anvend.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("kontrollplan.revisjonAnvend")}
                  {oppsummering && ` (${oppsummering.fristerOppdateres + nyeKlare.length + arkiverUids.size})`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
