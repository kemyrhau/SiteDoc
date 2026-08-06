// Delte HMS-tabell-komponenter (prosjekt- og firma-nivå).
// 2026-05-28: konvertert fra plain HTML-tabell til @sitedoc/ui Table — gir
// sortering, kolonnefilter, kolonnebredde-resize, status-snarvei.
// Filter-state holdes lokalt per komponent-instans (tab-bytte i firma-HMS
// nullstiller tilstand — akseptert trade-off; tabs har uansett ulike kolonner).

import { useState, useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { formaterDato, formaterLopenummer, hentDataVerdi } from "./visning";
import { hosPosisjon, type MineIder } from "@/lib/hms-hos";
import type { DokumentRad } from "./types";

type TabellProps = {
  rader: DokumentRad[];
  onKlikk: (rad: DokumentRad) => void;
  visProsjektKolonne?: boolean;
  visByggeplassKolonne?: boolean;
  onHurtigBehandle?: (rad: DokumentRad) => void;
  // Bruker-/faggruppe-ID → navn, for person-/firma-felt (RUH: Innmelder m.m.)
  navneLookup?: Map<string, string>;
  // «Hos»-kolonne (Ordre 2.3/Funn G) — kun prosjekt-lista, ikke firma-aggregatet.
  visHosKolonne?: boolean;
  mineIder?: MineIder;
};

// «Hos»-celle: flytmodellens perspektiv-vokabular via delt hosPosisjon-avledning.
// Terminal → «Lukket»; ballen hos innlogget → «Venter på deg»; ellers «Hos {ledd}».
function HosCelle({ rad, mineIder }: { rad: DokumentRad; mineIder?: MineIder }) {
  const { t } = useTranslation();
  const { bucket, aktivNavn } = hosPosisjon(rad, mineIder);
  if (bucket === "lukket" || bucket === "utkast") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
        {t(bucket === "lukket" ? "status.lukket" : "status.utkast")}
      </span>
    );
  }
  if (bucket === "deg") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        {t("tabell.venterPaaDeg")}
      </span>
    );
  }
  if (!aktivNavn) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
      {t("hms.hos", { navn: aktivNavn })}
    </span>
  );
}

type KolDef = {
  id: string;
  header: string;
  celle: (rad: DokumentRad) => JSX.Element;
  bredde?: string;
  sorterbar?: boolean;
  sorterVerdi?: (rad: DokumentRad) => string | number | null;
  filtrerbar?: boolean;
  filterAlternativer?: { value: string; label: string }[];
  filterSnarveier?: { label: string; verdier: string[] }[];
};

// «Åpne» statuser — brukes av Avvik-snarveien
const ALLE_APNE_STATUSER = ["draft", "sent", "received", "in_progress", "responded"];

// Bygg filter-alternativer ut fra unike verdier i radene
function unikeVerdier(rader: DokumentRad[], hent: (r: DokumentRad) => string): { value: string; label: string }[] {
  const sett = new Set<string>();
  for (const r of rader) {
    const v = hent(r);
    if (v && v !== "—") sett.add(v);
  }
  return Array.from(sett)
    .sort((a, b) => a.localeCompare(b, "nb-NO"))
    .map((v) => ({ value: v, label: v }));
}

function byggeplassNavnAvvik(r: DokumentRad): string {
  return r.drawing?.byggeplass?.name ?? "—";
}
function byggeplassNavnSjekkliste(r: DokumentRad): string {
  return r.byggeplass?.name ?? "—";
}

// Generisk filtrerings-funksjon — kalt med kolonne-id → rad-verdi-mapping
function filtrerRader(
  rader: DokumentRad[],
  filterVerdier: Record<string, string>,
  feltMapping: Record<string, (r: DokumentRad) => string>,
): DokumentRad[] {
  let resultat = rader;
  for (const [kolId, verdi] of Object.entries(filterVerdier)) {
    if (!verdi) continue;
    const valgteSet = new Set(verdi.split(","));
    const hentFelt = feltMapping[kolId];
    if (!hentFelt) continue;
    resultat = resultat.filter((r) => valgteSet.has(hentFelt(r)));
  }
  return resultat;
}

/* ============================================================================
 *  AvvikTabell
 * ============================================================================ */

export function AvvikTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
  onHurtigBehandle,
  visHosKolonne = false,
  mineIder,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentAlvorlighet = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("alvorlig"));

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnAvvik,
    alvorlighet: hentAlvorlighet,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "tittel",
      header: t("tabell.tittel"),
      celle: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
      sorterbar: true,
      sorterVerdi: (r) => r.title,
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnAvvik(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnAvvik,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnAvvik),
      });
    }
    k.push({
      id: "alvorlighet",
      header: t("hms.kolonne.alvorlighet"),
      celle: (r) => <span className="text-sm text-gray-700">{hentAlvorlighet(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentAlvorlighet,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentAlvorlighet),
    });
    if (visHosKolonne) {
      k.push({
        id: "hos",
        header: t("hms.kolonne.hos"),
        celle: (r) => <HosCelle rad={r} mineIder={mineIder} />,
        bredde: "180px",
        sorterbar: true,
        sorterVerdi: (r) => hosPosisjon(r, mineIder).aktivNavn ?? "",
      });
    }
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
      filterSnarveier: [{ label: t("status.alleApne"), verdier: ALLE_APNE_STATUSER }],
    });
    k.push({
      id: "tidsfrist",
      header: t("tabell.tidsfrist"),
      celle: (r) => <span className="text-sm text-gray-700">{formaterDato(r.dueDate ?? null)}</span>,
      bredde: "120px",
      sorterbar: true,
      sorterVerdi: (r) => r.dueDate ?? "",
    });
    if (onHurtigBehandle) {
      k.push({
        id: "behandle",
        header: "",
        celle: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHurtigBehandle(r);
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            {t("firma.hms.hurtig.knapp")}
          </button>
        ),
        bredde: "100px",
      });
    }
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, onHurtigBehandle, visHosKolonne, mineIder, t]);

  // Tom-sjekk ETTER alle hooks (unngår hook-order-krasj når segment-filter tømmer lista).
  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.avvik")} description={t("hms.tom.avvikBeskrivelse")} />;
  }

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.avvik")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}

/* ============================================================================
 *  SjaTabell
 * ============================================================================ */

export function SjaTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
  visHosKolonne = false,
  mineIder,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentArbeidsleder = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("arbeidsleder"));

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnSjekkliste,
    arbeidsleder: hentArbeidsleder,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "tittel",
      header: t("tabell.tittel"),
      celle: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
      sorterbar: true,
      sorterVerdi: (r) => r.title,
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnSjekkliste(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnSjekkliste,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnSjekkliste),
      });
    }
    k.push({
      id: "dato",
      header: t("tabell.dato"),
      celle: (r) => (
        <span className="text-sm text-gray-700">
          {hentDataVerdi(r, (l) => l.toLowerCase() === "dato")}
        </span>
      ),
      sorterbar: true,
      sorterVerdi: (r) => hentDataVerdi(r, (l) => l.toLowerCase() === "dato"),
    });
    k.push({
      id: "arbeidsleder",
      header: t("hms.kolonne.arbeidsleder"),
      celle: (r) => <span className="text-sm text-gray-700">{hentArbeidsleder(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentArbeidsleder,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentArbeidsleder),
    });
    if (visHosKolonne) {
      k.push({
        id: "hos",
        header: t("hms.kolonne.hos"),
        celle: (r) => <HosCelle rad={r} mineIder={mineIder} />,
        bredde: "180px",
        sorterbar: true,
        sorterVerdi: (r) => hosPosisjon(r, mineIder).aktivNavn ?? "",
      });
    }
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
    });
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, visHosKolonne, mineIder, t]);

  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.sja")} description={t("hms.tom.sjaBeskrivelse")} />;
  }

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.sja")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}

/* ============================================================================
 *  RuhTabell
 * ============================================================================ */

export function RuhTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
  navneLookup,
  visHosKolonne = false,
  mineIder,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentTypeObservasjon = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("type"), navneLookup);
  const hentInnmelder = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("innmelder"), navneLookup);

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnAvvik,
    typeObservasjon: hentTypeObservasjon,
    innmelder: hentInnmelder,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "typeObservasjon",
      header: t("hms.kolonne.typeObservasjon"),
      celle: (r) => <span className="text-sm text-gray-700">{hentTypeObservasjon(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentTypeObservasjon,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentTypeObservasjon),
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnAvvik(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnAvvik,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnAvvik),
      });
    }
    k.push({
      id: "innmelder",
      header: t("hms.kolonne.innmelder"),
      celle: (r) => <span className="text-sm text-gray-700">{hentInnmelder(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentInnmelder,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentInnmelder),
    });
    k.push({
      id: "opprettelsesdato",
      header: t("tabell.opprettelsesdato"),
      celle: (r) => <span className="text-sm text-gray-700">{formaterDato(r.createdAt)}</span>,
      bredde: "120px",
      sorterbar: true,
      sorterVerdi: (r) => r.createdAt,
    });
    if (visHosKolonne) {
      k.push({
        id: "hos",
        header: t("hms.kolonne.hos"),
        celle: (r) => <HosCelle rad={r} mineIder={mineIder} />,
        bredde: "180px",
        sorterbar: true,
        sorterVerdi: (r) => hosPosisjon(r, mineIder).aktivNavn ?? "",
      });
    }
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
    });
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, navneLookup, visHosKolonne, mineIder, t]);

  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.ruh")} description={t("hms.tom.ruhBeskrivelse")} />;
  }

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.ruh")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}
