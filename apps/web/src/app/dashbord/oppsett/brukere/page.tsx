"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Users,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Shield,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { KontaktForklaringsboks } from "@/components/oppsett/KontaktForklaringsboks";
import { FlytChip } from "@/components/oppsett/FlytChip";
import { OpprettKontaktModal } from "../produksjon/_components/OpprettKontaktModal";
import { HmsBehandlerHandlinger } from "@/components/hms/HmsBehandlerHandlinger";
import { finnHmsGruppe, erHmsGruppe, byggHmsKontakter, type HmsGruppe } from "@/components/hms/hms-utils";

/* ------------------------------------------------------------------ */
/*  KompaktBadgeListe — viser første verdi + "+N" utvidbar             */
/* ------------------------------------------------------------------ */

function KompaktBadgeListe({
  verdier,
  bgKlasse,
  leggTilKnapp,
}: {
  verdier: string[];
  bgKlasse: string;
  leggTilKnapp?: React.ReactNode;
}) {
  const [utvidet, setUtvidet] = useState(false);

  if (verdier.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">—</span>
        {leggTilKnapp}
      </div>
    );
  }

  if (verdier.length === 1) {
    return (
      <div className="flex items-center gap-1">
        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
          {verdier[0]}
        </span>
        {leggTilKnapp}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {utvidet ? (
        <>
          {verdier.map((v) => (
            <span key={v} className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
              {v}
            </span>
          ))}
          <button
            onClick={() => setUtvidet(false)}
            className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </>
      ) : (
        <>
          <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
            {verdier[0]}
          </span>
          <button
            onClick={() => setUtvidet(true)}
            className="inline-flex rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-300"
          >
            +{verdier.length - 1}
          </button>
        </>
      )}
      {leggTilKnapp}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KontaktTabell                                                      */
/* ------------------------------------------------------------------ */

interface KontaktMedlem {
  id: string;
  role: string;
  erFirmaansvarlig: boolean;
  kanAttestere: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    organization?: { id: string; name: string } | null;
  };
  faggruppeKoblinger: Array<{
    faggruppe: { id: string; name: string; color: string | null };
  }>;
}

function KontaktTabell({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [kollapserteGrupper, setKollapserteGrupper] = useState<Set<string>>(new Set());
  const harInitialisertKollaps = useRef(false);
  const [redigerMedlemId, setRedigerMedlemId] = useState<string | null>(null);
  const [redigerData, setRedigerData] = useState({ name: "", email: "", phone: "", role: "" });
  const [filterNavn, setFilterNavn] = useState("");
  const [filterRolle, setFilterRolle] = useState("");
  const [filterFaggruppe, setFilterFaggruppe] = useState("");
  const [filterGruppe, setFilterGruppe] = useState("");
  const [redigerGruppeNavn, setRedigerGruppeNavn] = useState<string | null>(null);
  const [nyGruppeNavnVerdi, setNyGruppeNavnVerdi] = useState("");
  const [leggTilMedlemIGruppe, setLeggTilMedlemIGruppe] = useState<string | null>(null);
  const [nyGruppeInput, setNyGruppeInput] = useState(false);
  const [nyGruppeNavn, setNyGruppeNavn] = useState("");
  const [nyKontaktOpen, setNyKontaktOpen] = useState(false);

  const settFirmaansvarligMutation = trpc.medlem.settFirmaansvarlig.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const settKanAttestereMutation = trpc.medlem.settKanAttestere.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const ledigeFirmaBrukereQuery = trpc.medlem.hentLedigeFirmaBrukere.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId && nyKontaktOpen },
  );
  const ledigeFirmaBrukere = (ledigeFirmaBrukereQuery.data ?? []) as Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>;

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const { data: alleFaggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  // Dokumentflyter — grunnlag for flyt-chips per kontakt (avledet klientside)
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const { data: dbGrupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const fjernMutation = trpc.medlem.fjernFraFaggruppe.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterGruppeMutation = trpc.gruppe.oppdater.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      setRedigerGruppeNavn(null);
      setNyGruppeNavnVerdi("");
    },
  });

  const slettGruppeMutation = trpc.gruppe.slett.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const leggTilMedlemMutation = trpc.gruppe.leggTilMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      setLeggTilMedlemIGruppe(null);
    },
  });

  const fjernMedlemMutation = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterModulerMutation = trpc.gruppe.oppdaterModuler.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterDomenerMutation = trpc.gruppe.oppdaterDomener.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const opprettGruppeMutation = trpc.gruppe.opprett.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      setNyGruppeInput(false);
      setNyGruppeNavn("");
    },
  });

  // Default kollaps: lukk alle grupper ved første lasting
  useEffect(() => {
    if (harInitialisertKollaps.current || !dbGrupper) return;
    const alleNavn = (dbGrupper as Array<{ name: string }>).map((g) => g.name);
    alleNavn.push(t("brukere.utenGruppe"));
    setKollapserteGrupper(new Set(alleNavn));
    harInitialisertKollaps.current = true;
  }, [dbGrupper, t]);

  // Esc avslutter redigeringsmodus uavhengig av fokusert element
  // (dropdown, attestering-link osv. — input-felter har egen Esc-håndtering)
  useEffect(() => {
    if (!redigerMedlemId) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setRedigerMedlemId(null);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [redigerMedlemId]);

  const oppdaterMedlemMutation = trpc.medlem.oppdater.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      setRedigerMedlemId(null);
    },
  });

  const startRediger = (m: KontaktMedlem) => {
    setRedigerMedlemId(m.id);
    setRedigerData({
      name: m.user.name ?? "",
      email: m.user.email,
      phone: m.user.phone ?? "",
      role: m.role,
    });
  };

  const lagreRediger = (medlemId: string) => {
    oppdaterMedlemMutation.mutate({
      id: medlemId,
      projectId: prosjektId,
      name: redigerData.name.trim() || undefined,
      email: redigerData.email.trim() || undefined,
      phone: redigerData.phone.trim() || undefined,
      role: (redigerData.role as "member" | "admin") || undefined,
    });
  };

  // Bygg gruppe-map: userId → gruppenavn[]
  const gruppeMap: Record<string, string[]> = {};
  if (dbGrupper) {
    for (const g of dbGrupper as Array<{ name: string; members: Array<{ projectMember: { user: { id: string } } }> }>) {
      for (const m of g.members) {
        const userId = m.projectMember.user.id;
        if (!gruppeMap[userId]) gruppeMap[userId] = [];
        gruppeMap[userId].push(g.name);
      }
    }
  }

  // Bygg gruppeNavn → gruppeId map og gruppeId → userId → gruppeMedlemId map
  const gruppeNavnTilId = useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; name: string }>) {
        map[g.name] = g.id;
      }
    }
    return map;
  }, [dbGrupper]);

  // Bygg gruppeId → modules map
  const gruppeModuler = useMemo((): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; modules: unknown }>) {
        map[g.id] = (g.modules as string[] | null) ?? [];
      }
    }
    return map;
  }, [dbGrupper]);

  // Bygg gruppeId → domains map (bygg/hms/kvalitet)
  const gruppeDomener = useMemo((): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; domains: unknown }>) {
        map[g.id] = (g.domains as string[] | null) ?? [];
      }
    }
    return map;
  }, [dbGrupper]);

  const gruppeMedlemIdMap = useMemo((): Record<string, Record<string, string>> => {
    // gruppeId → userId → gruppeMedlemId
    const map: Record<string, Record<string, string>> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; members: Array<{ id: string; projectMember: { user: { id: string } } | null }> }>) {
        const innerMap: Record<string, string> = {};
        for (const m of g.members) {
          if (m.projectMember?.user?.id) {
            innerMap[m.projectMember.user.id] = m.id;
          }
        }
        map[g.id] = innerMap;
      }
    }
    return map;
  }, [dbGrupper]);

  // Bygg map fra userId → brukerinfo for leggTilMedlem
  const medlemTilPmId = useMemo((): Record<string, { id: string; email: string; name: string | null; phone: string | null }> => {
    const map: Record<string, { id: string; email: string; name: string | null; phone: string | null }> = {};
    if (medlemmer) {
      for (const m of medlemmer as KontaktMedlem[]) {
        map[m.user.id] = { id: m.id, email: m.user.email, name: m.user.name, phone: m.user.phone };
      }
    }
    return map;
  }, [medlemmer]);

  const kontakterRå = (medlemmer ?? []) as KontaktMedlem[];

  // Flyt-chips per kontakt — avledet klientside fra dokumentflyt-medlemskap.
  // Deltakelse via person, gruppe eller faggruppe ekspanderes likt til personer
  // (mockup-fasit: «kilden ser du i redigering»). Ingen ny tilgangsberegning.
  const flytChipsPerMedlem = useMemo(() => {
    const map = new Map<string, Array<{ flytNavn: string; rolleLabel: string; key: string }>>();
    const dflyter = dokumentflyter as
      | Array<{
          id: string;
          name: string;
          roller?: Array<{ rolle: string; label?: string | null }> | null;
          medlemmer: Array<{
            rolle: string;
            projectMember?: { id: string } | null;
            group?: { id: string } | null;
            faggruppe?: { id: string } | null;
          }>;
        }>
      | undefined;
    if (!dflyter) return map;

    // groupId → projectMemberId[] (via user.id → medlemTilPmId)
    const gruppePmIder = new Map<string, string[]>();
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; members: Array<{ projectMember: { user: { id: string } } | null }> }>) {
        const ids: string[] = [];
        for (const gm of g.members) {
          const uid = gm.projectMember?.user?.id;
          const pmId = uid ? medlemTilPmId[uid]?.id : undefined;
          if (pmId) ids.push(pmId);
        }
        gruppePmIder.set(g.id, ids);
      }
    }

    // faggruppeId → projectMemberId[]
    const faggruppePmIder = new Map<string, string[]>();
    for (const m of kontakterRå) {
      for (const k of m.faggruppeKoblinger) {
        const arr = faggruppePmIder.get(k.faggruppe.id) ?? [];
        arr.push(m.id);
        faggruppePmIder.set(k.faggruppe.id, arr);
      }
    }

    const leggTil = (pmId: string, flytNavn: string, flytId: string, rolle: string, rolleLabel: string) => {
      const arr = map.get(pmId) ?? [];
      const key = `${flytId}-${rolle}`;
      if (!arr.some((c) => c.key === key)) arr.push({ flytNavn, rolleLabel, key });
      map.set(pmId, arr);
    };

    for (const df of dflyter) {
      const roller = df.roller ?? [];
      for (const dm of df.medlemmer) {
        const label = roller.find((r) => r.rolle === dm.rolle)?.label ?? t(`dokumentflyt.${dm.rolle}`);
        if (dm.projectMember?.id) {
          leggTil(dm.projectMember.id, df.name, df.id, dm.rolle, label);
        } else if (dm.group?.id) {
          for (const pmId of gruppePmIder.get(dm.group.id) ?? []) leggTil(pmId, df.name, df.id, dm.rolle, label);
        } else if (dm.faggruppe?.id) {
          for (const pmId of faggruppePmIder.get(dm.faggruppe.id) ?? []) leggTil(pmId, df.name, df.id, dm.rolle, label);
        }
      }
    }
    return map;
  }, [dokumentflyter, dbGrupper, kontakterRå, medlemTilPmId, t]);

  // Filtrer kontakter
  const kontakter = useMemo(() => {
    let resultat = kontakterRå;
    if (filterNavn) {
      const søk = filterNavn.toLowerCase();
      resultat = resultat.filter((m) =>
        (m.user.name ?? "").toLowerCase().includes(søk) ||
        m.user.email.toLowerCase().includes(søk) ||
        (m.user.phone ?? "").includes(søk),
      );
    }
    if (filterRolle) {
      if (filterRolle === "firmaansvarlig") {
        resultat = resultat.filter((m) => m.erFirmaansvarlig);
      } else {
        resultat = resultat.filter((m) => m.role === filterRolle);
      }
    }
    if (filterFaggruppe) {
      resultat = resultat.filter((m) =>
        m.faggruppeKoblinger.some((e) => e.faggruppe.id === filterFaggruppe),
      );
    }
    if (filterGruppe) {
      const gUserIder = new Set(
        (dbGrupper as Array<{ id: string; members: Array<{ projectMember: { user: { id: string } } | null }> }> ?? [])
          .find((g) => g.id === filterGruppe)?.members
          .map((gm) => gm.projectMember?.user?.id)
          .filter(Boolean) ?? [],
      );
      resultat = resultat.filter((m) => gUserIder.has(m.user.id));
    }
    return resultat;
  }, [kontakterRå, filterNavn, filterRolle, filterFaggruppe, filterGruppe, dbGrupper]);

  // Grupper kontakter etter brukergruppe med overskrifter
  // Medlemmer vises under HVER gruppe de tilhører (ingen deduplisering mellom grupper)
  const gruppertKontakter = useMemo(() => {
    const rader: Array<{ type: "header"; gruppeNavn: string; antall: number } | { type: "medlem"; medlem: KontaktMedlem; gruppeNavn: string }> = [];
    const medlemmerMedGruppe = new Set<string>();

    // Ordre 2.1 §3 (Funn H): HMS-gruppa (domene "hms", category="field") løftes inn i
    // matrisen ved siden av brukergruppene — den ble usynlig kun fordi den ikke er
    // "brukergrupper". Vises som en ordinær grupperad (Auto-merke + hms-domene-chip +
    // tom-varsel avledes i header-renderen).
    const brukerGrupperListe = dbGrupper
      ? (dbGrupper as Array<{ id: string; name: string; category: string; domains?: unknown; members: Array<{ projectMember: { user: { id: string } } | null }> }>)
          .filter((g) => g.category === "brukergrupper" || erHmsGruppe(g))
      : [];

    for (const g of brukerGrupperListe) {
      const gruppeKontakter = kontakter.filter((m) =>
        g.members.some((gm) => gm.projectMember?.user?.id === m.user.id),
      );
      rader.push({ type: "header", gruppeNavn: g.name, antall: gruppeKontakter.length });
      for (const m of gruppeKontakter) {
        rader.push({ type: "medlem", medlem: m, gruppeNavn: g.name });
        medlemmerMedGruppe.add(m.id);
      }
    }

    const utenGruppe = kontakter.filter((m) => !medlemmerMedGruppe.has(m.id));
    if (utenGruppe.length > 0) {
      const utenGruppeNavn = t("brukere.utenGruppe");
      rader.push({ type: "header", gruppeNavn: utenGruppeNavn, antall: utenGruppe.length });
      for (const m of utenGruppe) {
        rader.push({ type: "medlem", medlem: m, gruppeNavn: utenGruppeNavn });
      }
    }

    return rader;
  }, [kontakter, dbGrupper, t]);

  // Ordre 2.1 §3 (Funn H): HMS-behandler-leddet (HMS-gruppa) tomt → banner m/ ett-klikks
  // «Meld meg inn» + «Velg andre». Server håndhever admin på handlingene.
  const hmsGruppe = useMemo(
    () => finnHmsGruppe(dbGrupper as unknown as HmsGruppe[] | undefined),
    [dbGrupper],
  );
  const hmsKontakter = useMemo(
    () =>
      byggHmsKontakter(
        kontakterRå.map((m) => ({ id: m.id, user: { name: m.user.name, email: m.user.email } })),
        hmsGruppe,
      ),
    [kontakterRå, hmsGruppe],
  );
  const hmsTom = !!hmsGruppe && hmsGruppe.members.length === 0;

  return (
    <div className="-mx-6 -mt-6">
      <div className="sticky top-0 z-30 bg-gray-50 px-6 pt-6 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t("brukere.kontakter")}</h2>
          <div className="flex items-center gap-2">
            {nyGruppeInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nyGruppeNavn}
                  onChange={(e) => setNyGruppeNavn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nyGruppeNavn.trim()) {
                      opprettGruppeMutation.mutate({ projectId: prosjektId, name: nyGruppeNavn.trim(), category: "brukergrupper" });
                    } else if (e.key === "Escape") {
                      setNyGruppeInput(false);
                      setNyGruppeNavn("");
                    }
                  }}
                  autoFocus
                  placeholder={t("brukere.gruppenavn")}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => { setNyGruppeInput(false); setNyGruppeNavn(""); }}
                  className="rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNyGruppeInput(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                {t("brukere.nyGruppe")}
              </button>
            )}
            <button
              onClick={() => setNyKontaktOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              {t("kontaktside.nyKontakt")}
            </button>
            <HjelpKnapp>
              <HjelpFane tittel={t("hjelp.faneFirma")}>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaOverskrift")}</h3>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaBeskrivelse")}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.faggruppeOverskrift")}</h3>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.faggruppeBeskrivelse")}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                    <p className="text-sm font-medium text-blue-800">{t("hjelp.firmaEksempelTittel")}</p>
                    <p className="mt-1 text-sm text-blue-700">{t("hjelp.firmaEksempel")}</p>
                  </div>
                </div>
              </HjelpFane>
              <HjelpFane tittel={t("hjelp.faneRoller")}>
                <div className="space-y-3">
                  {[
                    { rolleKey: "admin", person: "Ola Nordmann", skjoldFarge: "text-blue-500" },
                    { rolleKey: "firmaansvarlig", person: "Trude Tømrer", skjoldFarge: "text-amber-500" },
                    { rolleKey: "registrator", person: "Kari Hansen" },
                    { rolleKey: "medlem", person: "Per Arbeider" },
                  ].map((r) => (
                    <div key={r.rolleKey} className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.skjoldFarge && <Shield className={`h-4 w-4 ${r.skjoldFarge}`} />}
                        <span className="text-sm font-semibold text-gray-900">
                          {t(`hjelp.rolle.${r.rolleKey}.navn`)}
                        </span>
                        <span className="text-xs text-gray-400">({r.person})</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{t(`hjelp.rolle.${r.rolleKey}.beskrivelse`)}</p>
                    </div>
                  ))}
                </div>
              </HjelpFane>
              <HjelpFane tittel={t("hjelp.faneDokumentflyt")}>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">{t("hjelp.flytBeskrivelse")}</p>
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
                      <div className="text-xs font-semibold text-blue-700">Elektro</div>
                      <div className="mt-1 text-xs text-blue-500">3 personer</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-center">
                      <div className="text-xs font-semibold text-purple-700">Byggherre</div>
                      <div className="mt-1 text-xs text-purple-500">4 personer</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
                      <div className="text-xs font-semibold text-green-700">Tømrer</div>
                      <div className="mt-1 text-xs text-green-500">2 personer</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <span className="text-sm font-semibold text-gray-900">{t("hjelp.flytBlåPrikk")}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{t("hjelp.flytForklaring1")}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Leser</span>
                        <span className="text-sm font-semibold text-gray-900">{t("hjelp.flytRettighet")}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{t("hjelp.flytForklaring2")}</p>
                    </div>
                  </div>
                </div>
              </HjelpFane>
            </HjelpKnapp>
          </div>
        </div>
      </div>
      <div className="px-6 pt-3 pb-6">
      <KontaktForklaringsboks />
      {hmsTom && hmsGruppe && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("hms.tomBanner.tittel")}
          </div>
          <p className="text-sm leading-relaxed text-gray-600">{t("hms.tomBanner.beskrivelse")}</p>
          <HmsBehandlerHandlinger prosjektId={prosjektId} hmsGruppeId={hmsGruppe.id} kontakter={hmsKontakter} />
        </div>
      )}
      <div className="rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-[69px] z-20 border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500 shadow-sm">
            <tr>
              <th className="px-4 py-2.5">{t("tabell.navn")}</th>
              <th className="px-4 py-2.5">{t("kontaktside.kolFlytRolle")}</th>
              <th className="px-4 py-2.5">{t("brukere.epost")}</th>
              <th className="px-4 py-2.5">{t("brukere.telefon")}</th>
              <th className="px-4 py-2.5">{t("brukere.firma")}</th>
              <th className="px-4 py-2.5">{t("brukere.rolle")}</th>
              <th className="px-4 py-2.5">{t("brukere.faggrupper")}</th>
              <th className="px-4 py-2.5">{t("brukere.grupper")}</th>
            </tr>
            {/* Filterrad */}
            <tr className="border-b border-gray-200 bg-gray-50">
              <th colSpan={4} className="px-4 py-1.5">
                <input
                  type="text"
                  value={filterNavn}
                  onChange={(e) => setFilterNavn(e.target.value)}
                  placeholder={t("handling.sok")}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                />
              </th>
              <th className="px-4 py-1.5" />
              <th className="px-4 py-1.5">
                <select
                  value={filterRolle}
                  onChange={(e) => setFilterRolle(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  <option value="admin">Admin</option>
                  <option value="firmaansvarlig">{t("brukere.firmaansvarlig")}</option>
                  <option value="member">{t("brukere.medlem")}</option>
                </select>
              </th>
              <th className="px-4 py-1.5">
                <select
                  value={filterFaggruppe}
                  onChange={(e) => setFilterFaggruppe(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  {(alleFaggrupper as Array<{ id: string; name: string }> ?? []).map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-1.5">
                <select
                  value={filterGruppe}
                  onChange={(e) => setFilterGruppe(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  {(dbGrupper as Array<{ id: string; name: string; category: string }> ?? [])
                    .filter((g) => g.category === "brukergrupper")
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))
                  }
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gruppertKontakter.map((rad, idx) => {
              if (rad.type === "header") {
                const erKollapset = kollapserteGrupper.has(rad.gruppeNavn);
                const gruppeId = gruppeNavnTilId[rad.gruppeNavn];
                const erUtenGruppe = !gruppeId;
                const erHms = !!gruppeId && gruppeId === hmsGruppe?.id;
                const toggleKollaps = () => {
                  setKollapserteGrupper((prev) => {
                    const ny = new Set(prev);
                    ny.has(rad.gruppeNavn) ? ny.delete(rad.gruppeNavn) : ny.add(rad.gruppeNavn);
                    return ny;
                  });
                };

                // Medlemmer som ikke allerede er i denne gruppen (for legg-til-dropdown)
                const medlemmerIkkeIGruppe = gruppeId
                  ? kontakterRå.filter((k) => !gruppeMedlemIdMap[gruppeId]?.[k.user.id])
                  : [];

                return (
                  <tr
                    key={`header-${idx}`}
                    className="group/gheader bg-gray-100 border-t-2 border-gray-200 cursor-pointer hover:bg-gray-200/80"
                  >
                    <td colSpan={8} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600">
                        <span onClick={toggleKollaps} className="flex items-center gap-2">
                          {erKollapset
                            ? <ChevronRight className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                          <Users className="h-3.5 w-3.5" />
                        </span>

                        {/* Inline rename or group name */}
                        {redigerGruppeNavn === rad.gruppeNavn && gruppeId ? (
                          <input
                            type="text"
                            value={nyGruppeNavnVerdi}
                            onChange={(e) => setNyGruppeNavnVerdi(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && nyGruppeNavnVerdi.trim()) {
                                oppdaterGruppeMutation.mutate({
                                  id: gruppeId,
                                  name: nyGruppeNavnVerdi.trim(),
                                  projectId: prosjektId,
                                });
                              } else if (e.key === "Escape") {
                                setRedigerGruppeNavn(null);
                                setNyGruppeNavnVerdi("");
                              }
                            }}
                            onBlur={() => {
                              if (nyGruppeNavnVerdi.trim() && nyGruppeNavnVerdi.trim() !== rad.gruppeNavn) {
                                oppdaterGruppeMutation.mutate({
                                  id: gruppeId,
                                  name: nyGruppeNavnVerdi.trim(),
                                  projectId: prosjektId,
                                });
                              } else {
                                setRedigerGruppeNavn(null);
                                setNyGruppeNavnVerdi("");
                              }
                            }}
                            autoFocus
                            className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span onClick={toggleKollaps}>{rad.gruppeNavn}</span>
                        )}

                        <span className="font-normal text-gray-400" onClick={toggleKollaps}>({rad.antall})</span>

                        {/* Ordre 2.1 §3: HMS-gruppa er auto-provisjonert — Auto-merke + tom-varsel */}
                        {erHms && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 normal-case">
                            {t("hms.autoMerke")}
                          </span>
                        )}
                        {erHms && rad.antall === 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold normal-case tracking-normal text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            {t("hms.ingenBehandlere")}
                          </span>
                        )}

                        {/* Modul-badges — alltid klikkbare for toggle */}
                        {!erUtenGruppe && gruppeId && (() => {
                          const moduler = gruppeModuler[gruppeId] ?? [];
                          const MODUL_LABELS: Record<string, { label: string; aktivBg: string; inaktivBg: string }> = {
                            sjekklister: { label: t("nav.sjekklister"), aktivBg: "bg-green-100 text-green-700", inaktivBg: "bg-gray-100 text-gray-400 line-through" },
                            oppgaver: { label: t("nav.oppgaver"), aktivBg: "bg-blue-100 text-blue-700", inaktivBg: "bg-gray-100 text-gray-400 line-through" },
                            tegninger: { label: t("nav.tegninger"), aktivBg: "bg-amber-100 text-amber-700", inaktivBg: "bg-gray-100 text-gray-400 line-through" },
                            "3d": { label: "3D", aktivBg: "bg-purple-100 text-purple-700", inaktivBg: "bg-gray-100 text-gray-400 line-through" },
                          };
                          const alleModulNavn: Array<"sjekklister" | "oppgaver" | "tegninger" | "3d"> = ["sjekklister", "oppgaver", "tegninger", "3d"];

                          return (
                            <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {alleModulNavn.map((mod) => {
                                const info = MODUL_LABELS[mod]!;
                                const erAktiv = moduler.includes(mod);
                                return (
                                  <button
                                    key={mod}
                                    type="button"
                                    onClick={() => {
                                      const nyeModuler = erAktiv
                                        ? moduler.filter((m) => m !== mod) as typeof alleModulNavn
                                        : [...moduler, mod] as typeof alleModulNavn;
                                      oppdaterModulerMutation.mutate({
                                        groupId: gruppeId,
                                        projectId: prosjektId,
                                        modules: nyeModuler,
                                      });
                                    }}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal transition-colors cursor-pointer hover:opacity-80 ${
                                      erAktiv ? info.aktivBg : info.inaktivBg
                                    }`}
                                    title={erAktiv ? `${info.label}: aktiv — klikk for å deaktivere` : `${info.label}: inaktiv — klikk for å aktivere`}
                                  >
                                    {info.label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Domene-velger — bygg/hms/kvalitet, wirer gruppe.oppdaterDomener (admin-gatet server-side) */}
                        {!erUtenGruppe && gruppeId && (() => {
                          const domener = gruppeDomener[gruppeId] ?? [];
                          const DOMENER: Array<{ key: "bygg" | "hms" | "kvalitet"; label: string; aktivBg: string }> = [
                            { key: "bygg", label: t("brukere.domene.bygg"), aktivBg: "bg-sky-100 text-sky-700" },
                            { key: "hms", label: t("brukere.domene.hms"), aktivBg: "bg-red-100 text-red-700" },
                            { key: "kvalitet", label: t("brukere.domene.kvalitet"), aktivBg: "bg-emerald-100 text-emerald-700" },
                          ];

                          return (
                            <div className="ml-1 flex items-center gap-1 border-l border-gray-300 pl-2" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] font-medium normal-case tracking-normal text-gray-400">{t("brukere.domener")}</span>
                              {DOMENER.map((dom) => {
                                const erAktiv = domener.includes(dom.key);
                                return (
                                  <button
                                    key={dom.key}
                                    type="button"
                                    onClick={() => {
                                      const nyeDomener = (erAktiv
                                        ? domener.filter((d) => d !== dom.key)
                                        : [...domener, dom.key]) as Array<"bygg" | "hms" | "kvalitet">;
                                      oppdaterDomenerMutation.mutate({
                                        groupId: gruppeId,
                                        projectId: prosjektId,
                                        domains: nyeDomener,
                                      });
                                    }}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal transition-colors cursor-pointer hover:opacity-80 ${
                                      erAktiv ? dom.aktivBg : "bg-gray-100 text-gray-400 line-through"
                                    }`}
                                    title={erAktiv ? t("brukere.domeneAktivHint", { domene: dom.label }) : t("brukere.domeneInaktivHint", { domene: dom.label })}
                                  >
                                    {dom.label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Action buttons - visible on hover, only for real groups */}
                        {!erUtenGruppe && (
                          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/gheader:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRedigerGruppeNavn(rad.gruppeNavn);
                                setNyGruppeNavnVerdi(rad.gruppeNavn);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              title={t("handling.rediger")}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeggTilMedlemIGruppe((prev) => prev === gruppeId ? null : gruppeId!);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              title={t("brukere.leggTilMedlem")}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t("brukere.slettGruppeBekreftelse"))) {
                                  slettGruppeMutation.mutate({ id: gruppeId!, projectId: prosjektId });
                                }
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                              title={t("brukere.slettGruppe")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Legg til medlem — custom dropdown */}
                      {leggTilMedlemIGruppe === gruppeId && gruppeId && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-medium text-gray-500">{t("brukere.leggTilMedlem")}</span>
                            <button
                              onClick={() => setLeggTilMedlemIGruppe(null)}
                              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
                            {medlemmerIkkeIGruppe.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-400 italic">{t("brukere.ingenMedlemmer")}</div>
                            ) : (
                              medlemmerIkkeIGruppe.map((k) => {
                                const faggruppeNavn = k.faggruppeKoblinger.map((e) => e.faggruppe.name).join(", ");
                                return (
                                  <button
                                    key={k.user.id}
                                    onClick={() => {
                                      const info = medlemTilPmId[k.user.id];
                                      if (info) {
                                        const nameParts = (info.name ?? "").split(" ");
                                        const firstName = nameParts[0] || info.email;
                                        const lastName = nameParts.slice(1).join(" ") || "-";
                                        leggTilMedlemMutation.mutate({
                                          groupId: gruppeId,
                                          projectId: prosjektId,
                                          email: info.email,
                                          firstName,
                                          lastName,
                                          phone: info.phone ?? undefined,
                                        });
                                      }
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                                  >
                                    <span className="font-medium text-gray-700">{k.user.name ?? k.user.email}</span>
                                    {faggruppeNavn && <span className="text-gray-400">· {faggruppeNavn}</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }

              if (kollapserteGrupper.has(rad.gruppeNavn)) return null;

              const m = rad.medlem;
              const brukerGrupper = gruppeMap[m.user.id] ?? [];
              const faggruppeIder = new Set(m.faggruppeKoblinger.map((e) => e.faggruppe.id));
              const tilgjengeligeFaggrupper = (alleFaggrupper ?? []).filter(
                (e: { id: string }) => !faggruppeIder.has(e.id),
              );
              const radGruppeId = gruppeNavnTilId[rad.gruppeNavn];
              const gruppeMedlemId = radGruppeId
                ? gruppeMedlemIdMap[radGruppeId]?.[m.user.id]
                : undefined;

              const erRedigering = redigerMedlemId === m.id;

              return (
                <tr key={`${m.id}-${rad.gruppeNavn}`} className="group/mrow hover:bg-gray-50">
                  {/* Navn */}
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {erRedigering ? (
                        <input
                          value={redigerData.name}
                          onChange={(e) => setRedigerData((p) => ({ ...p, name: e.target.value }))}
                          className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") lagreRediger(m.id);
                            if (e.key === "Escape") setRedigerMedlemId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          {m.role === "admin" && (
                            <span title="Admin"><Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" /></span>
                          )}
                          {m.erFirmaansvarlig && m.role !== "admin" && (
                            <span title={t("brukere.firmaansvarlig")}><Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>
                          )}
                          <button
                            type="button"
                            onClick={() => startRediger(m)}
                            className="inline-flex items-center gap-1 text-left text-gray-900 hover:text-blue-600"
                            title={t("handling.rediger")}
                          >
                            <span>{m.user.name ?? "—"}</span>
                            <Pencil className="h-3 w-3 text-gray-300 group-hover/mrow:text-gray-400" />
                          </button>
                          {radGruppeId && gruppeMedlemId && (
                            <button
                              onClick={() => fjernMedlemMutation.mutate({ id: gruppeMedlemId, projectId: prosjektId })}
                              className="rounded p-0.5 text-gray-300 opacity-0 group-hover/mrow:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
                              title={t("brukere.fjernMedlem")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                  {/* Deltar i dokumentflyt · rolle — flyt-chips (stille avledet) */}
                  <td className="px-4 py-2.5">
                    {(() => {
                      const chips = flytChipsPerMedlem.get(m.id) ?? [];
                      if (chips.length === 0) return <span className="text-xs text-gray-300">—</span>;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {chips.map((c) => (
                            <FlytChip key={c.key} flytNavn={c.flytNavn} rolle={c.rolleLabel} />
                          ))}
                        </div>
                      );
                    })()}
                  </td>

                  {/* E-post */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {erRedigering ? (
                      <input
                        value={redigerData.email}
                        onChange={(e) => setRedigerData((p) => ({ ...p, email: e.target.value }))}
                        className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") lagreRediger(m.id);
                          if (e.key === "Escape") setRedigerMedlemId(null);
                        }}
                      />
                    ) : (
                      m.user.email
                    )}
                  </td>

                  {/* Telefon */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {erRedigering ? (
                      <input
                        value={redigerData.phone}
                        onChange={(e) => setRedigerData((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") lagreRediger(m.id);
                          if (e.key === "Escape") setRedigerMedlemId(null);
                        }}
                      />
                    ) : (
                      m.user.phone ?? "—"
                    )}
                  </td>

                  {/* Firma — read-only (kan ikke endres via medlem.oppdater per SCREENING-29-1) */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {(m.user as KontaktMedlem["user"]).organization?.name ?? "—"}
                  </td>

                  {/* Rolle */}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      {erRedigering ? (
                        <select
                          value={m.erFirmaansvarlig && m.role !== "admin" ? "firmaansvarlig" : redigerData.role}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "firmaansvarlig") {
                              // Sett role=member + erFirmaansvarlig=true
                              setRedigerData((p) => ({ ...p, role: "member" }));
                              settFirmaansvarligMutation.mutate({ id: m.id, projectId: prosjektId, erFirmaansvarlig: true });
                            } else if (val === "admin") {
                              // Sett role=admin + erFirmaansvarlig=false
                              setRedigerData((p) => ({ ...p, role: "admin" }));
                              if (m.erFirmaansvarlig) {
                                settFirmaansvarligMutation.mutate({ id: m.id, projectId: prosjektId, erFirmaansvarlig: false });
                              }
                            } else {
                              // Medlem: role=member + erFirmaansvarlig=false
                              setRedigerData((p) => ({ ...p, role: "member" }));
                              if (m.erFirmaansvarlig) {
                                settFirmaansvarligMutation.mutate({ id: m.id, projectId: prosjektId, erFirmaansvarlig: false });
                              }
                            }
                          }}
                          className="rounded border border-blue-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="member">{t("brukere.medlem")}</option>
                          <option value="firmaansvarlig">{t("brukere.firmaansvarlig")}</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          m.role === "admin"
                            ? "bg-blue-50 text-blue-700"
                            : m.erFirmaansvarlig
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}>
                          {m.role === "admin" ? "Admin" : m.erFirmaansvarlig ? t("brukere.firmaansvarlig") : t("brukere.medlem")}
                        </span>
                      )}

                      {/* Attestering sub-pill — kapabilitet (ikke rolle) */}
                      {m.role === "admin" ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 opacity-60"
                          title={t("oppsett.attesteringImplisittAdmin") ?? ""}
                        >
                          ✓ {t("oppsett.attestering")}
                        </span>
                      ) : m.kanAttestere ? (
                        <button
                          type="button"
                          onClick={() => settKanAttestereMutation.mutate({ id: m.id, projectId: prosjektId, kanAttestere: false })}
                          disabled={settKanAttestereMutation.isPending}
                          className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          ✓ {t("oppsett.attestering")}
                        </button>
                      ) : erRedigering ? (
                        <button
                          type="button"
                          onClick={() => settKanAttestereMutation.mutate({ id: m.id, projectId: prosjektId, kanAttestere: true })}
                          disabled={settKanAttestereMutation.isPending}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-blue-600 disabled:opacity-50"
                        >
                          + {t("oppsett.giAttestering")}
                        </button>
                      ) : null}
                    </div>
                  </td>

                  {/* Faggrupper (read-only) */}
                  <td className="px-4 py-2.5">
                    <KompaktBadgeListe
                      verdier={m.faggruppeKoblinger.map((me) => me.faggruppe.name)}
                      bgKlasse="bg-gray-100 text-gray-700"
                    />
                  </td>

                  {/* Grupper */}
                  <td className="px-4 py-2.5">
                    {erRedigering ? (
                      <div className="space-y-1">
                        {/* Nåværende grupper med fjern-knapp */}
                        <div className="flex flex-wrap gap-1">
                          {brukerGrupper.map((gNavn) => {
                            const gId = gruppeNavnTilId[gNavn];
                            const gmId = gId ? gruppeMedlemIdMap[gId]?.[m.user.id] : undefined;
                            return (
                              <span key={gNavn} className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                                {gNavn}
                                {gmId && (
                                  <button
                                    onClick={() => fjernMedlemMutation.mutate({ id: gmId, projectId: prosjektId })}
                                    className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5"
                                    title={t("handling.fjern")}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {/* Legg til i gruppe */}
                        <select
                          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs w-full"
                          onChange={(e) => {
                            if (e.target.value) {
                              const nameParts = (m.user.name ?? "").split(" ");
                              leggTilMedlemMutation.mutate({
                                groupId: e.target.value,
                                projectId: prosjektId,
                                email: m.user.email,
                                firstName: nameParts[0] || m.user.email,
                                lastName: nameParts.slice(1).join(" ") || "-",
                              });
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">{t("brukere.leggTilGruppe")}</option>
                          {(dbGrupper as Array<{ id: string; name: string; category: string }> ?? [])
                            .filter((g) => g.category === "brukergrupper" && !brukerGrupper.includes(g.name))
                            .map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))
                          }
                        </select>
                        {/* Lagre/Avbryt */}
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => lagreRediger(m.id)}
                            className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                          >
                            {t("handling.lagre")}
                          </button>
                          <button
                            onClick={() => setRedigerMedlemId(null)}
                            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                          >
                            {t("handling.avbryt")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <KompaktBadgeListe
                        verdier={brukerGrupper}
                        bgKlasse="bg-blue-50 text-blue-700"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <OpprettKontaktModal
        open={nyKontaktOpen}
        onClose={() => setNyKontaktOpen(false)}
        prosjektId={prosjektId}
        faggrupper={((alleFaggrupper as Array<{ id: string; name: string; color: string | null }>) ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color ?? null,
        }))}
        dokumentflyter={((dokumentflyter as Array<{
          id: string;
          name: string;
          faggruppeId: string | null;
          roller?: Array<{ rolle: string; label?: string | null }> | null;
        }>) ?? []).map((df) => ({
          id: df.id,
          name: df.name,
          faggruppeId: df.faggruppeId,
          roller: df.roller ?? [],
        }))}
        tilgangsgrupper={((dbGrupper as Array<{ id: string; name: string; category: string }>) ?? [])
          .filter((g) => g.category === "brukergrupper")
          .map((g) => ({ id: g.id, name: g.name }))}
        ledigeFirmaBrukere={ledigeFirmaBrukere.map((b) => ({ id: b.id, name: b.name, email: b.email }))}
        onFerdig={() => {
          utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
          utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
          utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
          utils.medlem.hentLedigeFirmaBrukere.invalidate({ projectId: prosjektId });
        }}
      />
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Hovudside                                                          */
/* ------------------------------------------------------------------ */

export default function BrukereSide() {
  // Bruker-administrasjon er per-prosjekt men ikke per-byggeplass.
  // Deaktiverer byggeplass-velger i toppbar slik at brukeren ser at den
  // ikke har effekt på denne siden.
  useToppbarFiltre({ byggeplass: false });
  const { prosjektId } = useProsjekt();
  if (!prosjektId) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  return <KontaktTabell prosjektId={prosjektId} />;
}
