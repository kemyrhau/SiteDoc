"use client";

import { useTranslation } from "react-i18next";
import { Info, Loader2, Plus, ExternalLink } from "lucide-react";
import { datoTilUkeAar } from "@/lib/ms-project-parser";
import type { ImportTilordning, Faggruppe } from "./useImportTilordning";

interface ImportMalFaggruppeTilordningProps {
  steg: 2 | 3;
  projectId: string;
  tilordning: ImportTilordning;
}

/**
 * Presentasjonskomponent for mal/faggruppe-tilordningen i fremdriftsplan-importen.
 * Rendrer steg 2 (ressurs → faggruppe) eller steg 3 (oppgave → mal). All tilstand
 * og logikk ligger i useImportTilordning — komponenten er ren rendering av bundelen.
 * Trukket ut av ImportFremdriftsplanDialog (del 1.5) for gjenbruk i revisjons-diffen.
 */
export function ImportMalFaggruppeTilordning({ steg, projectId, tilordning }: ImportMalFaggruppeTilordningProps) {
  const { t } = useTranslation();
  const {
    valgteRessurser,
    manglendeRessurser,
    opprettende,
    ressursFaggruppeMap,
    setRessursFaggruppeMap,
    standardFaggruppeId,
    setStandardFaggruppeId,
    faggrupper,
    opprettFaggruppeForRessurs,
    opprettAlleManglende,
    grupperteOppgaver,
    gruppeFaggruppeMap,
    setGruppeFaggruppeMap,
    oppgaveMalMap,
    setOppgaveMalMap,
    brukForAlleIGruppen,
    malSok,
    setMalSok,
    aapenMalDropdown,
    setAapenMalDropdown,
    malTre,
    alleMaler,
    hentMalNavn,
  } = tilordning;

  function renderMalVelger(taskUid: number) {
    const valgtId = oppgaveMalMap.get(taskUid);
    const erAapen = aapenMalDropdown === taskUid;

    return (
      <div className="relative">
        <button
          onClick={() => setAapenMalDropdown(erAapen ? null : taskUid)}
          className={`text-left text-xs border rounded px-2 py-1 w-56 truncate ${
            valgtId ? "text-gray-900 bg-white" : "text-gray-400 bg-gray-50"
          }`}
        >
          {valgtId ? hentMalNavn(valgtId) : t("kontrollplan.sjekklisteMal") + "..."}
        </button>

        {erAapen && (
          <div className="absolute right-0 z-50 mt-1 w-80 max-h-72 overflow-y-auto bg-white border rounded-lg shadow-lg">
            <div className="sticky top-0 bg-white p-2 border-b">
              <input
                type="text"
                value={malSok}
                onChange={(e) => setMalSok(e.target.value)}
                placeholder={t("handling.soek") + "..."}
                className="w-full text-xs border rounded px-2 py-1"
                autoFocus
              />
            </div>
            <div className="p-1">
              {/* Standarder → maler (flat, sortert etter kapittelkode) */}
              {malTre.standarder.map((std) => {
                // Flat liste av alle maler under standarden, sortert etter kapittelkode
                const flatMaler = std.kapitler.flatMap((kap) =>
                  kap.maler.map((mal) => ({ ...mal, kapittelKode: kap.kode }))
                ).sort((a, b) => a.kapittelKode.localeCompare(b.kapittelKode));

                if (flatMaler.length === 0) return null;
                return (
                  <div key={std.kode} className="mb-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase px-2 py-0.5">
                      {std.kode} — {std.navn}
                    </div>
                    {flatMaler.map((mal) => (
                      <button
                        key={mal.id}
                        onClick={() => {
                          setOppgaveMalMap((prev) => new Map(prev).set(taskUid, mal.id));
                          setAapenMalDropdown(null);
                          setMalSok("");
                        }}
                        className={`w-full text-left text-xs px-3 py-1 hover:bg-blue-50 rounded ${
                          valgtId === mal.id ? "bg-blue-50 text-sitedoc-primary" : "text-gray-700"
                        }`}
                      >
                        {mal.prefix ? `${mal.prefix} — ` : ""}{mal.name}
                      </button>
                    ))}
                  </div>
                );
              })}
              {/* Prosjektmaler */}
              {malTre.prosjektmaler.length > 0 && (
                <div className="mb-1">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase px-2 py-0.5">
                    {t("kontrollplan.prosjektmaler") || "Prosjektmaler"}
                  </div>
                  {malTre.prosjektmaler.map((mal) => (
                    <button
                      key={mal.id}
                      onClick={() => {
                        setOppgaveMalMap((prev) => new Map(prev).set(taskUid, mal.id));
                        setAapenMalDropdown(null);
                        setMalSok("");
                      }}
                      className={`w-full text-left text-xs px-3 py-1 hover:bg-blue-50 rounded ${
                        valgtId === mal.id ? "bg-blue-50 text-sitedoc-primary" : "text-gray-700"
                      }`}
                    >
                      {mal.prefix ? `${mal.prefix} — ` : ""}{mal.name}
                    </button>
                  ))}
                </div>
              )}
              {alleMaler.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-2">
                  {t("kontrollplan.ingenMaler") || "Ingen maler funnet"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ STEG 2: Ressurser → Faggrupper ═══
  if (steg === 2) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">
          {t("kontrollplan.importSteg2Tittel")}
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {t("kontrollplan.importSteg2Beskrivelse")}
        </p>

        {/* Forklaring-boks */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3 flex gap-2">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            {t("kontrollplan.importForklaring")}
          </div>
        </div>

        {/* Bulk-opprett — kun når ≥2 mangler */}
        {valgteRessurser.length > 0 && manglendeRessurser.length >= 2 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <div className="text-xs text-amber-800">
              {t("kontrollplan.importManglerFaggruppe", { antall: manglendeRessurser.length })}
              <span className="text-amber-600 ml-1">
                ({manglendeRessurser.map((r) => r.name).join(", ")})
              </span>
            </div>
            <button
              onClick={opprettAlleManglende}
              disabled={opprettende.size > 0}
              className="flex items-center gap-1 text-xs text-amber-900 bg-white border border-amber-300 rounded px-2 py-1 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
            >
              {opprettende.size > 0 ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {t("kontrollplan.importOpprettAlleManglende", { antall: manglendeRessurser.length })}
            </button>
          </div>
        )}

        {valgteRessurser.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-3">
            {t("kontrollplan.importIngenRessurser")}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {valgteRessurser.map((r) => {
              const valgtFg = ressursFaggruppeMap.get(r.name);
              const oppretter = opprettende.has(r.name);
              return (
                <div key={r.name} className="flex items-center gap-3 py-2 px-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-400">
                      {r.taskCount} {t("kontrollplan.importAktiviteterLiten")}
                    </div>
                  </div>
                  <span className="text-gray-300">→</span>
                  <select
                    value={valgtFg ?? ""}
                    onChange={(e) => {
                      setRessursFaggruppeMap((prev) => {
                        const next = new Map(prev);
                        next.set(r.name, e.target.value || null);
                        return next;
                      });
                    }}
                    className="text-xs border rounded px-2 py-1.5 w-48"
                  >
                    <option value="">{t("kontrollplan.importIkkeTilordnet")}</option>
                    {faggrupper?.map((fg: { id: string; name: string; color: string | null }) => (
                      <option key={fg.id} value={fg.id}>
                        {fg.name}
                      </option>
                    ))}
                  </select>
                  {!valgtFg && (
                    <button
                      onClick={() => opprettFaggruppeForRessurs(r.name)}
                      disabled={oppretter}
                      className="flex items-center gap-1 text-xs text-sitedoc-primary border border-sitedoc-primary/30 rounded px-2 py-1 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap"
                      title={t("kontrollplan.importOpprettSomFaggruppe")}
                    >
                      {oppretter ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {oppretter
                        ? t("kontrollplan.importOppretterFaggruppe")
                        : t("kontrollplan.importOpprettSomFaggruppe")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Standard-faggruppe — alltid synlig */}
        <div className="flex items-center gap-3 py-2 px-3 border rounded-lg bg-gray-50">
          <div className="flex-1">
            <div className="text-sm text-gray-900">{t("kontrollplan.importStandardFaggruppe")}</div>
            <div className="text-xs text-gray-400">
              {t("kontrollplan.importStandardFaggruppeHjelp")}
            </div>
          </div>
          <select
            value={standardFaggruppeId ?? ""}
            onChange={(e) => setStandardFaggruppeId(e.target.value || null)}
            className="text-xs border rounded px-2 py-1.5 w-48"
          >
            <option value="">{t("kontrollplan.importIkkeTilordnet")}</option>
            {faggrupper?.map((fg: { id: string; name: string; color: string | null }) => (
              <option key={fg.id} value={fg.id}>
                {fg.name}
              </option>
            ))}
          </select>
        </div>

        {/* Lenke til faggruppe-admin */}
        <div className="mt-3 text-right">
          <a
            href={`/dashbord/${projectId}/faggrupper`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-sitedoc-primary"
          >
            {t("kontrollplan.importAdministrerFaggrupper")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  // ═══ STEG 3: Tilordne maler ═══
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        {t("kontrollplan.importSteg3Tittel")}
      </h3>

      {grupperteOppgaver.map((gruppe, gi) => {
        const overrideFgId = gruppeFaggruppeMap.get(gruppe.key);
        const overrideFg = overrideFgId
          ? (faggrupper as Faggruppe[])?.find((f) => f.id === overrideFgId) ?? null
          : null;
        const visFg = gruppe.faggruppe ?? overrideFg;

        return (
        <div key={gi} className="mb-4">
          {/* Gruppehode */}
          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b">
            {visFg ? (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: visFg.color || "#6b7280" }}
                />
                <span className="text-xs font-medium text-gray-700">{visFg.name}</span>
              </>
            ) : (
              <span className="text-xs font-medium text-gray-400">{t("kontrollplan.importIkkeTilordnet")}</span>
            )}
            <span className="text-xs text-gray-400">({gruppe.oppgaver.length})</span>

            {/* Faggruppe-velger for grupper uten faggruppe */}
            {!gruppe.faggruppe && (
              <select
                value={overrideFgId ?? ""}
                onChange={(e) => {
                  setGruppeFaggruppeMap((prev) => {
                    const next = new Map(prev);
                    if (e.target.value) next.set(gruppe.key, e.target.value);
                    else next.delete(gruppe.key);
                    return next;
                  });
                }}
                className="text-[10px] border rounded px-1.5 py-0.5 ml-1"
              >
                <option value="">{t("kontrollplan.importVelgFaggruppe")}</option>
                {faggrupper?.map((fg: { id: string; name: string }) => (
                  <option key={fg.id} value={fg.id}>{fg.name}</option>
                ))}
              </select>
            )}

            {/* Bruk for alle */}
            {gruppe.oppgaver.length > 1 && oppgaveMalMap.has(gruppe.oppgaver[0]!.uid) && (
              <button
                onClick={() => {
                  const malId = oppgaveMalMap.get(gruppe.oppgaver[0]!.uid);
                  if (malId) brukForAlleIGruppen(gruppe.oppgaver, malId);
                }}
                className="ml-auto text-[10px] text-sitedoc-primary hover:underline"
              >
                {t("kontrollplan.importBrukForAlle")}
              </button>
            )}
          </div>

          {/* Oppgaver i gruppen */}
          <div className="space-y-1">
            {gruppe.oppgaver.map((oppgave) => {
              const frist = oppgave.finish ? datoTilUkeAar(oppgave.finish) : null;
              return (
                <div key={oppgave.uid} className="flex items-center gap-2 py-1 px-2 text-xs">
                  <span className="flex-1 truncate text-gray-700">{oppgave.name}</span>
                  {frist && (
                    <span className="text-gray-400 whitespace-nowrap">
                      uke {frist.uke}/{frist.aar}
                    </span>
                  )}
                  {renderMalVelger(oppgave.uid)}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
