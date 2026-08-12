import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { datoTilUkeAar, hentRessurserForValgteOppgaver } from "@/lib/ms-project-parser";
import type { MSProjectData, MSProjectTask } from "@/lib/ms-project-parser";

// Ett resultatpunkt fra tilordningen (én valgt aktivitet med mal + faggruppe + frist).
export type ImportPunkt = {
  taskUid: number;
  name: string;
  wbs: string | null;
  malId: string;
  faggruppeId: string | null;
  frist: { uke: number; aar: number } | null;
};

export type Faggruppe = { id: string; name: string; color: string | null };

interface MalNode { id: string; name: string; prefix: string | null }
interface KapittelNode { kode: string; navn: string; maler: MalNode[] }
interface StandardNode { kode: string; navn: string; kapitler: KapittelNode[] }

// Fargepalett for auto-genererte faggrupper
const FARGE_PALETT = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

interface UseImportTilordningInput {
  projectId: string;
  parsedData: MSProjectData | null;
  selectedUIDs: Set<number>;
  stegNr: number;
}

/**
 * Eier all tilstand og logikk for mal/faggruppe-tilordningen (steg 2 + 3) i
 * fremdriftsplan-importen. Trukket ut av ImportFremdriftsplanDialog (del 1.5)
 * slik at revisjons-diffen (del 2) kan gjenbruke samme tilordning uten å
 * gjenskape state. Ingen funksjonsendring fra dialogen — logikken er flyttet
 * ordrett.
 */
export function useImportTilordning({ projectId, parsedData, selectedUIDs, stegNr }: UseImportTilordningInput) {
  const utils = trpc.useUtils();

  // Steg 2: Ressurs → faggruppe
  const [ressursFaggruppeMap, setRessursFaggruppeMap] = useState<Map<string, string | null>>(new Map());
  // Steg 2: Standard-faggruppe (for aktiviteter uten ressurs)
  const [standardFaggruppeId, setStandardFaggruppeId] = useState<string | null>(null);
  // Steg 3: Oppgave → mal + faggruppe-override per gruppe
  const [oppgaveMalMap, setOppgaveMalMap] = useState<Map<number, string>>(new Map());
  const [gruppeFaggruppeMap, setGruppeFaggruppeMap] = useState<Map<string, string>>(new Map());
  const [malSok, setMalSok] = useState("");
  const [aapenMalDropdown, setAapenMalDropdown] = useState<number | null>(null);
  // Opprettelsesstatus per ressursnavn
  const [opprettende, setOpprettende] = useState<Set<string>>(new Set());

  // Data — hent faggrupper fra steg 2+, maler fra steg 3+
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId },
    { enabled: stegNr >= 2 },
  );
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId },
    { enabled: stegNr >= 3 },
  );
  const { data: bibliotekValg } = trpc.bibliotek.hentProsjektValg.useQuery(
    { projectId },
    { enabled: stegNr >= 3 },
  );

  const opprettFaggruppe = trpc.faggruppe.opprett.useMutation();

  const nesteFarge = useCallback((ekstraBrukte: Set<string> = new Set()) => {
    const brukte = new Set<string>([
      ...(faggrupper ?? []).map((fg: { color: string | null }) => fg.color ?? ""),
      ...ekstraBrukte,
    ]);
    const ledig = FARGE_PALETT.find((f) => !brukte.has(f));
    return ledig ?? FARGE_PALETT[Math.floor(Math.random() * FARGE_PALETT.length)]!;
  }, [faggrupper]);

  const opprettFaggruppeForRessurs = useCallback(async (ressursNavn: string, forhandstildeltFarge?: string) => {
    if (opprettende.has(ressursNavn)) return;
    setOpprettende((prev) => new Set(prev).add(ressursNavn));
    try {
      const ny = await opprettFaggruppe.mutateAsync({
        name: ressursNavn,
        projectId,
        color: forhandstildeltFarge ?? nesteFarge(),
      });
      await utils.faggruppe.hentForProsjekt.invalidate({ projectId });
      setRessursFaggruppeMap((prev) => {
        const next = new Map(prev);
        next.set(ressursNavn, ny.id);
        return next;
      });
    } finally {
      setOpprettende((prev) => {
        const next = new Set(prev);
        next.delete(ressursNavn);
        return next;
      });
    }
  }, [opprettFaggruppe, projectId, utils, opprettende, nesteFarge]);

  // ──────── Steg 2: Ressurser ────────

  const valgteRessurser = useMemo(() => {
    if (!parsedData) return [];
    return hentRessurserForValgteOppgaver(parsedData.flatTasks, selectedUIDs);
  }, [parsedData, selectedUIDs]);

  // Auto-match ressurser til faggrupper ved overgang til steg 2
  const initSteg2 = useCallback(() => {
    if (!faggrupper) return;
    const map = new Map<string, string | null>();
    for (const r of valgteRessurser) {
      const match = faggrupper.find((fg: { name: string }) =>
        r.name.toLowerCase().includes(fg.name.toLowerCase()) ||
        fg.name.toLowerCase().includes(r.name.toLowerCase()),
      );
      map.set(r.name, match ? (match as { id: string }).id : null);
    }
    setRessursFaggruppeMap(map);
  }, [faggrupper, valgteRessurser]);

  // Ressurser uten matching faggruppe
  const manglendeRessurser = useMemo(() => {
    return valgteRessurser.filter((r) => !ressursFaggruppeMap.get(r.name));
  }, [valgteRessurser, ressursFaggruppeMap]);

  const opprettAlleManglende = useCallback(async () => {
    const brukteIBatch = new Set<string>();
    for (const r of manglendeRessurser) {
      const farge = nesteFarge(brukteIBatch);
      brukteIBatch.add(farge);
      await opprettFaggruppeForRessurs(r.name, farge);
    }
  }, [manglendeRessurser, opprettFaggruppeForRessurs, nesteFarge]);

  // ──────── Steg 3: Mal-tre ────────

  const malTre = useMemo(() => {
    if (!maler) return { standarder: [] as StandardNode[], prosjektmaler: [] as MalNode[] };

    const sjekklister = maler.filter((m: { category: string }) => m.category === "sjekkliste");
    const sok = malSok.toLowerCase();

    const bibMap = new Map<string, { kapittelKode: string; kapittelNavn: string; standardKode: string; standardNavn: string }>();
    if (bibliotekValg) {
      for (const v of bibliotekValg) {
        if (v.sjekklisteMalId && v.bibliotekMal) {
          bibMap.set(v.sjekklisteMalId, {
            kapittelKode: v.bibliotekMal.kapittel.kode,
            kapittelNavn: v.bibliotekMal.kapittel.navn,
            standardKode: v.bibliotekMal.kapittel.standard.kode,
            standardNavn: v.bibliotekMal.kapittel.standard.navn,
          });
        }
      }
    }

    const standardMap = new Map<string, { kode: string; navn: string; kapitler: Map<string, { kode: string; navn: string; maler: MalNode[] }> }>();
    const prosjektmaler: MalNode[] = [];

    for (const m of sjekklister) {
      const mal = m as { id: string; name: string; prefix: string | null };
      if (sok && !mal.name.toLowerCase().includes(sok) && !(mal.prefix ?? "").toLowerCase().includes(sok)) continue;

      const bib = bibMap.get(mal.id);
      if (bib) {
        if (!standardMap.has(bib.standardKode)) {
          standardMap.set(bib.standardKode, { kode: bib.standardKode, navn: bib.standardNavn, kapitler: new Map() });
        }
        const std = standardMap.get(bib.standardKode)!;
        if (!std.kapitler.has(bib.kapittelKode)) {
          std.kapitler.set(bib.kapittelKode, { kode: bib.kapittelKode, navn: bib.kapittelNavn, maler: [] });
        }
        std.kapitler.get(bib.kapittelKode)!.maler.push(mal);
      } else {
        prosjektmaler.push(mal);
      }
    }

    const standarder: StandardNode[] = [...standardMap.values()].map((s) => ({
      kode: s.kode,
      navn: s.navn,
      kapitler: [...s.kapitler.values()],
    }));

    return { standarder, prosjektmaler };
  }, [maler, bibliotekValg, malSok]);

  // Flat mal-liste for enkel oppslag
  const alleMaler = useMemo(() => {
    if (!maler) return [];
    return maler.filter((m: { category: string }) => m.category === "sjekkliste") as Array<{ id: string; name: string; prefix: string | null }>;
  }, [maler]);

  const hentMalNavn = useCallback(
    (malId: string) => {
      const m = alleMaler.find((mal) => mal.id === malId);
      return m ? `${m.prefix ? m.prefix + " — " : ""}${m.name}` : "";
    },
    [alleMaler],
  );

  // Grupperte oppgaver for steg 3
  const grupperteOppgaver = useMemo(() => {
    if (!parsedData || !faggrupper) return [];

    const grupper = new Map<string, { key: string; faggruppe: Faggruppe | null; oppgaver: MSProjectTask[] }>();

    const valgteOppgaver = parsedData.flatTasks.filter((t) => selectedUIDs.has(t.uid));

    for (const oppgave of valgteOppgaver) {
      // Finn faggruppe via ressurs-mapping
      let faggruppeId: string | null = null;
      for (const rNavn of oppgave.resourceNames) {
        const mapped = ressursFaggruppeMap.get(rNavn);
        if (mapped) { faggruppeId = mapped; break; }
      }

      const key = faggruppeId ?? "__uten_faggruppe__";
      if (!grupper.has(key)) {
        const fg = faggruppeId
          ? (faggrupper as Faggruppe[]).find((f) => f.id === faggruppeId) ?? null
          : null;
        grupper.set(key, { key, faggruppe: fg, oppgaver: [] });
      }
      grupper.get(key)!.oppgaver.push(oppgave);
    }

    return [...grupper.values()];
  }, [parsedData, selectedUIDs, faggrupper, ressursFaggruppeMap]);

  const brukForAlleIGruppen = useCallback(
    (oppgaver: MSProjectTask[], malId: string) => {
      setOppgaveMalMap((prev) => {
        const next = new Map(prev);
        for (const o of oppgaver) next.set(o.uid, malId);
        return next;
      });
    },
    [],
  );

  // ──────── Resultat ────────

  const importPunkter = useMemo<ImportPunkt[]>(() => {
    if (!parsedData) return [];
    return parsedData.flatTasks
      .filter((t) => selectedUIDs.has(t.uid) && oppgaveMalMap.has(t.uid))
      .map((t) => {
        const malId = oppgaveMalMap.get(t.uid)!;
        // Finn faggruppe: ressurs-mapping → gruppe-override → standard-faggruppe
        let faggruppeId: string | null = null;
        for (const rNavn of t.resourceNames) {
          const mapped = ressursFaggruppeMap.get(rNavn);
          if (mapped) { faggruppeId = mapped; break; }
        }
        const gruppeKey = faggruppeId ?? "__uten_faggruppe__";
        // Sjekk gruppe-override fra steg 3
        if (!faggruppeId && gruppeFaggruppeMap.has(gruppeKey)) {
          faggruppeId = gruppeFaggruppeMap.get(gruppeKey)!;
        }
        // Fallback til standard-faggruppe fra steg 2
        if (!faggruppeId && standardFaggruppeId) {
          faggruppeId = standardFaggruppeId;
        }
        const frist = t.finish ? datoTilUkeAar(t.finish) : null;
        return { taskUid: t.uid, name: t.name, wbs: t.wbs, malId, faggruppeId, frist };
      });
  }, [parsedData, selectedUIDs, oppgaveMalMap, ressursFaggruppeMap, gruppeFaggruppeMap, standardFaggruppeId]);

  const ekskludertAntall = useMemo(() => {
    if (!parsedData) return 0;
    return parsedData.flatTasks.filter(
      (t) => selectedUIDs.has(t.uid) && !oppgaveMalMap.has(t.uid),
    ).length;
  }, [parsedData, selectedUIDs, oppgaveMalMap]);

  const fristRange = useMemo(() => {
    const uker = importPunkter
      .filter((p) => p.frist)
      .map((p) => p.frist!.uke);
    if (uker.length === 0) return null;
    return { fra: Math.min(...uker), til: Math.max(...uker) };
  }, [importPunkter]);

  const punkterUtenFaggruppe = useMemo(
    () => importPunkter.filter((p) => !p.faggruppeId).length,
    [importPunkter],
  );

  return {
    // queries
    faggrupper,
    maler,
    bibliotekValg,
    // state + setters
    ressursFaggruppeMap,
    setRessursFaggruppeMap,
    standardFaggruppeId,
    setStandardFaggruppeId,
    oppgaveMalMap,
    setOppgaveMalMap,
    gruppeFaggruppeMap,
    setGruppeFaggruppeMap,
    malSok,
    setMalSok,
    aapenMalDropdown,
    setAapenMalDropdown,
    opprettende,
    // handlere
    opprettFaggruppeForRessurs,
    opprettAlleManglende,
    initSteg2,
    brukForAlleIGruppen,
    // derived
    valgteRessurser,
    manglendeRessurser,
    malTre,
    alleMaler,
    hentMalNavn,
    grupperteOppgaver,
    importPunkter,
    ekskludertAntall,
    fristRange,
    punkterUtenFaggruppe,
  };
}

export type ImportTilordning = ReturnType<typeof useImportTilordning>;
