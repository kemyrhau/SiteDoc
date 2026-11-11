"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import { useSokRegistry, type SokTreff, type SokGruppe } from "@/hooks/useSokRegistry";
import { useDokumentSok } from "@/hooks/useDokumentSok";
import { leserHref, seAlleHref } from "@/lib/dokument-sok-ctrlk";
import { UtsnittVisning } from "@/components/ftd-sok/treff-liste";
import { byggUtsnitt } from "@/components/ftd-sok/utsnitt";
import { normaliserSok, matchScore } from "@sitedoc/shared";

/**
 * Global søkemodal (steg iv, 1b) — Ctrl/Cmd+K. Grupperer treff i INNSTILLINGER
 * + SIDER, med brødsmulesti og tastaturnavigasjon. Registeret utledes fra
 * hub-kort + sidebar (drift-fritt), og matcher diakritikk-tolerant.
 *
 * SØK-2: inne i et prosjekt kommer gruppa DOKUMENTER etter (innhold i dokumentene brukeren har
 * tilgang til, via `useDokumentSok`). Registertreffene vises med en gang; dokumentgruppa fylles
 * inn når kallet svarer.
 */

const GRUPPE_REKKEFOLGE: SokGruppe[] = ["innstillinger", "sider"];

// Kuraterte «vanlige innganger» ved tom query (vises hvis de finnes i registeret).
const VANLIGE_HREF: string[] = [
  "/dashbord/oppsett/produksjon/dokumentflyt",
  "/dashbord/firma/timer/lonnsarter",
];

const FLIS_STIL: Record<SokGruppe | "dokumenter", { flis: string; tekst: string }> = {
  innstillinger: { flis: "#e7edfb", tekst: "#1e40af" }, // blå
  sider: { flis: "#fbf3e2", tekst: "#92610a" }, // amber
  dokumenter: { flis: "#e6f4ea", tekst: "#166534" }, // grønn
};

/** Én valgbar rad i visningsrekkefølge — tastaturnavigasjonen går over alle grupper. */
type Rad =
  | { type: "register"; key: string; href: string; treff: SokTreff }
  | { type: "dokument"; key: string; href: string; dok: ReturnType<typeof useDokumentSok>["treff"][number] }
  | { type: "seAlle"; key: string; href: string };

export function SokModal({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const registry = useSokRegistry();
  const [q, setSq] = useState("");
  const dok = useDokumentSok(q);
  const [valgt, setValgt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Nullstill ved åpning + fokus.
  useEffect(() => {
    if (apen) {
      setSq("");
      setValgt(0);
      // Fokus etter render.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [apen]);

  const norm = normaliserSok(q.trim());

  const treff = useMemo<SokTreff[]>(() => {
    if (!norm) {
      // Tom query: kuraterte vanlige innganger, ellers de første treffene.
      const vanlige = VANLIGE_HREF.map((h) => registry.find((r) => r.href === h)).filter(
        (x): x is SokTreff => !!x,
      );
      const rest = registry.filter((r) => !vanlige.includes(r)).slice(0, 5 - vanlige.length);
      return [...vanlige, ...rest].slice(0, 5);
    }
    // Skrivefeil-tolerant + synonym-utvidet match (sok-match), score-sortert:
    // eksakt > prefiks > substring > fuzzy. Erstatter bar substring-filter.
    return registry
      .map((r) => ({ r, s: matchScore(r.norm, norm) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r);
  }, [norm, registry]);

  const grupper = GRUPPE_REKKEFOLGE.map((g) => ({
    gruppe: g,
    rader: treff.filter((r) => r.gruppe === g),
  })).filter((x) => x.rader.length > 0);

  const dokRader: Rad[] =
    norm && dok.prosjektId
      ? dok.treff.map((d) => ({
          type: "dokument" as const,
          key: `dok-${d.documentId}`,
          href: leserHref(dok.prosjektId!, d.documentId, dok.sokeord),
          dok: d,
        }))
      : [];
  const seAlle: Rad[] =
    dokRader.length > 0
      ? [{ type: "seAlle", key: "se-alle", href: seAlleHref(dok.prosjektId!, dok.sokeord) }]
      : [];
  const rader: Rad[] = [
    ...grupper.flatMap((g) =>
      g.rader.map((r) => ({ type: "register" as const, key: r.id, href: r.href, treff: r })),
    ),
    ...dokRader,
    ...seAlle,
  ];
  const visSokerDokumenter = !!norm && dok.venter && dokRader.length === 0;

  // Hold valgt-indeks innenfor grensene.
  useEffect(() => {
    setValgt((v) => Math.min(v, Math.max(0, rader.length - 1)));
  }, [rader.length]);

  function velg(indeks: number) {
    const rad = rader[indeks];
    if (!rad) return;
    onLukk();
    router.push(rad.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setValgt((v) => Math.min(v + 1, rader.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setValgt((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      velg(valgt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onLukk();
    }
  }

  if (!apen) return null;

  const radIndeks = (key: string) => rader.findIndex((r) => r.key === key);
  const gruppeEtikett = (gruppe: SokGruppe | "dokumenter") => (
    <div className="flex items-center gap-2 px-4 pb-1 pt-2">
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: FLIS_STIL[gruppe].flis, color: FLIS_STIL[gruppe].tekst }}
      >
        {t(`sok.gruppe.${gruppe}`)}
      </span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(15,23,42,0.42)" }}
      onMouseDown={onLukk}
    >
      <div
        className="w-[620px] max-w-[94vw] overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Søkefelt */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <Search className="h-4.5 w-4.5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setSq(e.target.value)}
            placeholder={t("sok.placeholder")}
            className="w-full text-[15px] text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Resultater */}
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {!norm && (
            <p className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t("sok.vanlige")}
            </p>
          )}
          {norm && rader.length === 0 && !visSokerDokumenter ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {t("sok.ingenTreff", { q: q.trim() })}
            </p>
          ) : (
            <>
            {grupper.map(({ gruppe, rader: gruppeRader }) => (
              <div key={gruppe} className="mb-1">
                {norm && gruppeEtikett(gruppe)}
                {gruppeRader.map((rad) => {
                  const flatIndeks = radIndeks(rad.id);
                  const erValgt = flatIndeks === valgt;
                  return (
                    <button
                      key={rad.id}
                      type="button"
                      onMouseEnter={() => setValgt(flatIndeks)}
                      onClick={() => velg(flatIndeks)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
                      style={erValgt ? { backgroundColor: "#eef3fd" } : undefined}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-gray-900">
                          {rad.tittel}
                        </span>
                        <span className="block truncate text-[11.5px] text-gray-500">
                          {rad.brodsmule.join(" › ")}
                        </span>
                      </span>
                      {erValgt && <CornerDownLeft className="h-4 w-4 shrink-0 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {(dokRader.length > 0 || visSokerDokumenter) && (
              <div className="mb-1">
                {gruppeEtikett("dokumenter")}
                {visSokerDokumenter && (
                  <p className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("sok.sokerDokumenter")}
                  </p>
                )}
                {[...dokRader, ...seAlle].map((rad) => {
                  const flatIndeks = radIndeks(rad.key);
                  const erValgt = flatIndeks === valgt;
                  return (
                    <button
                      key={rad.key}
                      type="button"
                      onMouseEnter={() => setValgt(flatIndeks)}
                      onClick={() => velg(flatIndeks)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
                      style={erValgt ? { backgroundColor: "#eef3fd" } : undefined}
                    >
                      {rad.type === "dokument" ? (
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-gray-900">
                            {rad.dok.filename}
                          </span>
                          <span className="line-clamp-2 text-[11.5px] text-gray-500">
                            <UtsnittVisning
                              deler={byggUtsnitt({
                                chunkText: rad.dok.chunkText,
                                søkeord: dok.sokeord,
                                utdrag: rad.dok.utdrag,
                                sectionTitle: rad.dok.sectionTitle,
                                metode: rad.dok.metode,
                              })}
                            />
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] font-medium text-sitedoc-primary">
                          {t("sok.seAlleDokumenter")}
                        </span>
                      )}
                      {erValgt && <CornerDownLeft className="h-4 w-4 shrink-0 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 text-[11.5px] text-gray-400">
          {t("sok.footer")}
        </div>
      </div>
    </div>
  );
}
