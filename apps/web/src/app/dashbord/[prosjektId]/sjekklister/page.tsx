"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import type { VerktoylinjeHandling } from "@/kontekst/navigasjon-kontekst";
import { Plus, Printer, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FlytIndikator } from "@/components/FlytIndikator";

// --- Typer ---

interface MalObjekt {
  id: string;
  label: string;
  type: string;
  config: Record<string, unknown> | null;
}

interface SjekklisteRad {
  id: string;
  title: string;
  subject: string | null;
  number: number | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
  template: { id: string; prefix: string | null; name: string; objects: MalObjekt[] };
  bestiller: { name: string | null } | null;
  bestillerEnterprise: { name: string };
  utforerEnterprise: { name: string };
  byggeplass: { id: string; name: string } | null;
  drawing: { name: string; floor: string | null } | null;
  recipientUser: { id: string; name: string | null } | null;
  recipientGroup: { id: string; name: string } | null;
  bestillerUserId?: string;
  dokumentflyt: {
    id: string;
    name: string;
    medlemmer: {
      id: string;
      rolle: string;
      steg: number;
      enterprise: { id: string; name: string } | null;
      projectMember: { user: { id: string; name: string | null } } | null;
      group: { id: string; name: string } | null;
    }[];
  } | null;
}

// --- Konstanter ---

const STATUS_ALTERNATIVER = [
  { value: "draft", labelKey: "status.utkast" },
  { value: "sent", labelKey: "status.sendt" },
  { value: "received", labelKey: "status.mottatt" },
  { value: "in_progress", labelKey: "status.underArbeid" },
  { value: "responded", labelKey: "status.besvart" },
  { value: "approved", labelKey: "status.godkjent" },
  { value: "rejected", labelKey: "status.avvist" },
  { value: "closed", labelKey: "status.lukket" },
  { value: "cancelled", labelKey: "status.avbrutt" },
];

const FILTRERBARE_TYPER = new Set([
  "list_single", "list_multi", "traffic_light",
  "text_field", "integer", "decimal", "calculation",
  "date", "date_time", "person", "persons", "company",
  "signature",
]);

interface KolonneParam {
  id: string;
  navnKey?: string;
  navn?: string;
  gruppe: "kolonner" | "posisjon" | "verdier";
  fast?: boolean;
}

const SYSTEM_KOLONNER: KolonneParam[] = [
  { id: "prefix", navnKey: "tabell.prefix", gruppe: "kolonner", fast: true },
  { id: "nr", navnKey: "tabell.nr", gruppe: "kolonner", fast: true },
  { id: "status", navnKey: "tabell.status", gruppe: "kolonner", fast: true },
  { id: "tittel", navnKey: "tabell.tittel", gruppe: "kolonner" },
  { id: "emne", navnKey: "tabell.emne", gruppe: "kolonner" },
  { id: "ansvarlig", navnKey: "tabell.ansvarlig", gruppe: "kolonner" },
  { id: "opprettetAv", navnKey: "tabell.opprettetAv", gruppe: "kolonner" },
  { id: "bestillerEntreprise", navnKey: "tabell.bestillerEntreprise", gruppe: "kolonner" },
  { id: "utforerEntreprise", navnKey: "tabell.utforerEntreprise", gruppe: "kolonner" },
  { id: "mal", navnKey: "tabell.mal", gruppe: "kolonner" },
  { id: "opprettet", navnKey: "tabell.opprettelsesdato", gruppe: "kolonner" },
  { id: "endret", navnKey: "tabell.endringsdato", gruppe: "kolonner" },
  { id: "frist", navnKey: "tabell.tidsfrist", gruppe: "kolonner" },
  { id: "flyt", navnKey: "tabell.flyt", gruppe: "kolonner" },
];

const POSISJON_KOLONNER: KolonneParam[] = [
  { id: "bygning", navnKey: "tabell.bygning", gruppe: "posisjon" },
  { id: "etasje", navnKey: "tabell.etasje", gruppe: "posisjon" },
  { id: "tegning", navnKey: "tabell.tegning", gruppe: "posisjon" },
];

const STANDARD_AKTIVE = new Set(["prefix", "nr", "emne", "status", "ansvarlig", "flyt", "bygning", "frist"]);
const STORAGE_KEY = "sitedoc-sjekkliste-kolonner-v5";

function hentLagredeKolonner(): Set<string> {
  if (typeof window === "undefined") return STANDARD_AKTIVE;
  try {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (lagret) return new Set(JSON.parse(lagret) as string[]);
  } catch { /* ignorer */ }
  return STANDARD_AKTIVE;
}

function lagreKolonner(kolonner: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...kolonner]));
  } catch { /* ignorer */ }
}

const BREDDE_KEY = "sitedoc-sjekkliste-bredder-v1";

function hentLagredeBredder(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const lagret = localStorage.getItem(BREDDE_KEY);
    if (lagret) return JSON.parse(lagret) as Record<string, number>;
  } catch { /* ignorer */ }
  return {};
}

function lagreBredder(bredder: Record<string, number>) {
  try {
    localStorage.setItem(BREDDE_KEY, JSON.stringify(bredder));
  } catch { /* ignorer */ }
}

// --- Hjelpefunksjoner ---

function formaterLopenummer(rad: SjekklisteRad): string {
  return rad.number ? String(rad.number).padStart(3, "0") : "—";
}

function formaterAnsvarlig(rad: SjekklisteRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  return rad.utforerEnterprise.name;
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function hentFeltVerdi(
  rad: SjekklisteRad,
  objektId: string,
  objektType?: string,
  navneLookup?: Map<string, string>,
): string {
  if (!rad.data) return "—";
  const verdi = rad.data[objektId];
  if (verdi == null || verdi === "") return "—";

  // Signatur: vis ✓ eller —
  if (objektType === "signature") return verdi ? "✓" : "—";

  // Dato: norsk format
  if (objektType === "date" && typeof verdi === "string") {
    try { return new Date(verdi).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }); } catch { return String(verdi); }
  }
  if (objektType === "date_time" && typeof verdi === "string") {
    try { return new Date(verdi).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(verdi); }
  }

  // Trafikklys: norsk tekst
  if (objektType === "traffic_light" && typeof verdi === "string") {
    const TRAFIKKLYS: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚪" };
    return TRAFIKKLYS[verdi] ?? verdi;
  }

  // Person/firma: oppslag i navne-map
  if ((objektType === "person" || objektType === "company") && typeof verdi === "string" && navneLookup) {
    return navneLookup.get(verdi) ?? verdi;
  }

  // Flere personer: oppslag for hver
  if (objektType === "persons" && Array.isArray(verdi) && navneLookup) {
    return verdi.map((id) => navneLookup.get(String(id)) ?? String(id)).join(", ");
  }

  if (typeof verdi === "string") return verdi;
  if (typeof verdi === "number") return String(verdi);
  if (typeof verdi === "boolean") return verdi ? "Ja" : "Nei";
  if (Array.isArray(verdi)) return verdi.map(String).join(", ");
  return String(verdi);
}

// --- KolonneVelger ---

function KolonneVelger({
  apen, onLukk, aktive, onToggle, verdiFelter,
}: {
  apen: boolean; onLukk: () => void; aktive: Set<string>; onToggle: (id: string) => void; verdiFelter: KolonneParam[];
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const [apneGrupper, setApneGrupper] = useState<Set<string>>(new Set(["kolonner", "posisjon", "verdier"]));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onLukk();
    }
    if (apen) document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, [apen, onLukk]);

  if (!apen) return null;

  const hentNavn = (p: KolonneParam) => p.navnKey ? t(p.navnKey) : (p.navn ?? p.id);
  const sokLower = sok.toLowerCase();
  const filtrer = (p: KolonneParam) => !sok || hentNavn(p).toLowerCase().includes(sokLower);
  const grupper = [
    { id: "kolonner", navn: t("kolonne.kolonner"), felter: SYSTEM_KOLONNER.filter((k) => !k.fast).filter(filtrer) },
    { id: "posisjon", navn: t("kolonne.posisjon"), felter: POSISJON_KOLONNER.filter(filtrer) },
    { id: "verdier", navn: t("kolonne.verdier"), felter: verdiFelter.filter(filtrer) },
  ].filter((g) => g.felter.length > 0);

  const toggleGruppe = (id: string) => {
    setApneGrupper((prev) => { const ny = new Set(prev); ny.has(id) ? ny.delete(id) : ny.add(id); return ny; });
  };

  return (
    <div ref={ref} className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input type="text" value={sok} onChange={(e) => setSok(e.target.value)} placeholder={t("sjekklister.sokPlaceholder")}
            className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none" autoFocus />
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto px-1 pb-2">
        {grupper.map((gruppe) => (
          <div key={gruppe.id}>
            <button onClick={() => toggleGruppe(gruppe.id)}
              className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              {apneGrupper.has(gruppe.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {gruppe.navn}
            </button>
            {apneGrupper.has(gruppe.id) && gruppe.felter.map((felt) => (
              <label key={felt.id} className="flex cursor-pointer items-center gap-2 py-1 pl-6 pr-2 text-xs hover:bg-gray-50">
                <input type="checkbox" checked={aktive.has(felt.id)} onChange={() => onToggle(felt.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
                <span className="truncate">{hentNavn(felt)}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
        <button onClick={() => onToggle("__reset__")} className="text-xs text-gray-500 hover:text-gray-700">{t("handling.nullstill")}</button>
        <button onClick={onLukk} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">{t("handling.ok")}</button>
      </div>
    </div>
  );
}

// --- Hovedkomponent ---

export default function SjekklisteSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const { aktivByggeplass, standardTegning } = useByggeplass();
  const [visModal, setVisModal] = useState(false);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visSlettModal, setVisSlettModal] = useState(false);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<Set<string>>(hentLagredeKolonner);
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>(hentLagredeBredder);
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});

  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sjekklister = sjekklisteQuery.data as any as SjekklisteRad[] | undefined;
  const isLoading = sjekklisteQuery.isLoading;

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const sjekklisteMaler = ((maler ?? []) as Array<{ id: string; name: string; prefix?: string; category: string }>).filter((m) => m.category === "sjekkliste");
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery({ projectId: params.prosjektId });
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery({ projectId: params.prosjektId });

  const slettMutation = trpc.sjekkliste.slett.useMutation({
    onSuccess: () => { utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId }); },
  });

  async function slettValgte() {
    setSlettFeil(null);
    for (const id of Array.from(valgte)) {
      try { await slettMutation.mutateAsync({ id }); }
      catch (err) { setSlettFeil(err instanceof Error ? err.message : "Ukjent feil"); return; }
    }
    setValgte(new Set());
    setVisSlettModal(false);
  }

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      router.push(`/dashbord/${params.prosjektId}/sjekklister/${resultat.id}`);
    },
  });

  function handleOpprettFraMal(malId: string) {
    const oppretter = mineEntrepriser?.[0];
    if (!oppretter) return;
    const alleDf = (dokumentflyter ?? []) as Array<{
      id: string;
      medlemmer: Array<{ enterprise?: { id: string } | null; group?: { id: string } | null; projectMember?: { id: string } | null; rolle: string }>;
      maler: Array<{ template: { id: string } }>;
    }>;
    const matchDf = alleDf.find((df) =>
      df.maler.some((m) => m.template.id === malId) &&
      df.medlemmer.some((m) => m.rolle === "oppretter" && (m.enterprise?.id === oppretter.id || m.group || m.projectMember)),
    );
    const svarer = matchDf?.medlemmer.find((m) => m.rolle === "svarer");
    opprettMutation.mutate({
      templateId: malId,
      bestillerEnterpriseId: oppretter.id,
      utforerEnterpriseId: svarer?.enterprise?.id ?? oppretter.id,
      dokumentflytId: matchDf?.id,
    });
  }

  const verktoylinjeHandlinger = useMemo((): VerktoylinjeHandling[] => {
    const h: VerktoylinjeHandling[] = [
      { id: "ny-sjekkliste", label: t("sjekklister.ny"), ikon: <Plus className="h-4 w-4" />, onClick: () => setVisModal(true), variant: "primary" },
    ];
    if (valgte.size > 0) {
      h.push({ id: "skriv-ut-valgte", label: `${t("handling.skrivUt")} (${valgte.size})`, ikon: <Printer className="h-4 w-4" />,
        onClick: () => router.push(`/dashbord/${params.prosjektId}/sjekklister/skriv-ut?ider=${Array.from(valgte).join(",")}`), variant: "secondary" });
      h.push({ id: "slett-valgte", label: `${t("handling.slett")} (${valgte.size})`, ikon: <Trash2 className="h-4 w-4" />,
        onClick: () => { setSlettFeil(null); setVisSlettModal(true); }, variant: "danger" });
    }
    return h;
    // eslint-disable-next-line
  }, [valgte, params.prosjektId, router, aktivByggeplass?.id, standardTegning?.id]);

  useVerktoylinje(verktoylinjeHandlinger, [valgte.size, aktivByggeplass?.id, standardTegning?.id]);

  // Verdier-kolonner fra maler
  const verdiFelter = useMemo<KolonneParam[]>(() => {
    const data = (sjekklister ?? []);
    const sett = new Map<string, KolonneParam>();
    for (const rad of data) {
      if (!rad.template?.objects) continue;
      for (const obj of rad.template.objects) {
        if (FILTRERBARE_TYPER.has(obj.type) && !sett.has(obj.id)) {
          sett.set(obj.id, { id: `felt:${obj.id}`, navn: obj.label, gruppe: "verdier" });
        }
      }
    }
    return [...sett.values()].sort((a, b) => (a.navn ?? "").localeCompare(b.navn ?? "", "nb-NO"));
  }, [sjekklister]);

  // Map objektId → type for spesialformatering
  const objektTyper = useMemo(() => {
    const map = new Map<string, string>();
    for (const rad of sjekklister ?? []) {
      for (const obj of rad.template?.objects ?? []) {
        if (!map.has(obj.id)) map.set(obj.id, obj.type);
      }
    }
    return map;
  }, [sjekklister]);

  // Navne-lookup for person/firma-IDer (fra dokumentflyt-medlemmer + entrepriser)
  const navneLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const df of dokumentflyter ?? []) {
      for (const m of (df as { medlemmer?: { projectMember?: { user?: { id: string; name: string | null } } | null; enterprise?: { id: string; name: string } | null }[] }).medlemmer ?? []) {
        if (m.projectMember?.user?.id && m.projectMember.user.name) {
          map.set(m.projectMember.user.id, m.projectMember.user.name);
        }
        if (m.enterprise?.id && m.enterprise.name) {
          map.set(m.enterprise.id, m.enterprise.name);
        }
      }
    }
    // Legg til fra sjekkliste-data (bestiller, entrepriser)
    for (const rad of sjekklister ?? []) {
      if (rad.bestiller?.name) map.set((rad as unknown as { bestillerUserId: string }).bestillerUserId ?? "", rad.bestiller.name);
      if (rad.bestillerEnterprise) map.set((rad as unknown as { bestillerEnterpriseId: string }).bestillerEnterpriseId ?? "", rad.bestillerEnterprise.name);
      if (rad.utforerEnterprise) map.set((rad as unknown as { utforerEnterpriseId: string }).utforerEnterpriseId ?? "", rad.utforerEnterprise.name);
    }
    return map;
  }, [dokumentflyter, sjekklister]);

  const alleKolonner = useMemo(() => [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter], [verdiFelter]);

  // Utled aktivt flyt-ledd for en rad (for filter/sortering)
  const hentFlytLedd = useCallback((rad: SjekklisteRad): string => {
    const medl = rad.dokumentflyt?.medlemmer;
    if (!medl || medl.length === 0) return "";
    // Finn mottaker-ledd
    const recipientGroupId = rad.recipientGroup?.id;
    const recipientUserId = rad.recipientUser?.id;
    if (rad.status === "closed" || rad.status === "approved") return "";
    for (const m of medl) {
      if (recipientGroupId && m.group?.id === recipientGroupId) return m.group.name;
      if (recipientUserId && m.projectMember?.user?.id === recipientUserId) return m.projectMember.user.name ?? "";
    }
    // Fallback: entreprise-match
    if (recipientUserId || recipientGroupId) {
      // Bruk første entreprise-medlem som fallback
      const ent = medl.find((m) => m.enterprise);
      if (ent?.enterprise) return ent.enterprise.name;
    }
    return "";
  }, []);

  // Dynamiske filteralternativer
  const dynamiskFilter = useMemo(() => {
    const data = (sjekklister ?? []);
    const bygg = (felter: (string | null | undefined)[]) =>
      [...new Set(felter.filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v }));
    const filter: Record<string, { value: string; label: string }[]> = {
      prefix: bygg(data.map((s) => s.template?.prefix)),
      emne: bygg(data.map((s) => s.subject)),
      ansvarlig: bygg(data.map((s) => formaterAnsvarlig(s))),
      opprettetAv: bygg(data.map((s) => s.bestiller?.name)),
      bestillerEntreprise: bygg(data.map((s) => s.bestillerEnterprise.name)),
      utforerEntreprise: bygg(data.map((s) => s.utforerEnterprise.name)),
      mal: bygg(data.map((s) => s.template.name)),
      bygning: bygg(data.map((s) => s.byggeplass?.name)),
      etasje: bygg(data.map((s) => s.drawing?.floor)),
      tegning: bygg(data.map((s) => s.drawing?.name)),
      flyt: bygg(data.map((s) => hentFlytLedd(s))),
      status: STATUS_ALTERNATIVER.map((s) => ({ value: s.value, label: t(s.labelKey) })),
    };
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      const type = objektTyper.get(objektId);
      filter[felt.id] = bygg(data.map((s) => { const v = hentFeltVerdi(s, objektId, type, navneLookup); return v === "—" ? null : v; }));
    }
    return filter;
  }, [sjekklister, verdiFelter, t, objektTyper, navneLookup]);

  // Filtrer
  const filtrerte = useMemo(() => {
    let resultat = (sjekklister ?? []);
    if (statusFilter === "avvist") {
      resultat = resultat.filter((s) => s.status === "rejected" || s.status === "cancelled");
    } else if (statusFilter) {
      resultat = resultat.filter((s) => s.status === statusFilter);
    }
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      resultat = resultat.filter((s) => {
        if (kolId.startsWith("felt:")) {
          const oid = kolId.replace("felt:", "");
          return hentFeltVerdi(s, oid, objektTyper.get(oid), navneLookup) === verdi;
        }
        switch (kolId) {
          case "prefix": return s.template?.prefix === verdi;
          case "status": return s.status === verdi;
          case "emne": return s.subject === verdi;
          case "ansvarlig": return formaterAnsvarlig(s) === verdi;
          case "opprettetAv": return s.bestiller?.name === verdi;
          case "bestillerEntreprise": return s.bestillerEnterprise.name === verdi;
          case "utforerEntreprise": return s.utforerEnterprise.name === verdi;
          case "mal": return s.template.name === verdi;
          case "bygning": return s.byggeplass?.name === verdi;
          case "etasje": return s.drawing?.floor === verdi;
          case "tegning": return s.drawing?.name === verdi;
          case "flyt": return hentFlytLedd(s) === verdi;
          default: return true;
        }
      });
    }
    return resultat;
  }, [sjekklister, statusFilter, filterVerdier]);

  const handleFilterEndring = useCallback((kolonneId: string, verdi: string) => {
    setFilterVerdier((prev) => ({ ...prev, [kolonneId]: verdi }));
  }, []);

  const handleToggleKolonne = useCallback((id: string) => {
    if (id === "__reset__") { setAktiveKolonner(new Set(STANDARD_AKTIVE)); lagreKolonner(new Set(STANDARD_AKTIVE)); return; }
    setAktiveKolonner((prev) => { const ny = new Set(prev); ny.has(id) ? ny.delete(id) : ny.add(id); lagreKolonner(ny); return ny; });
  }, []);

  const handleBreddeEndring = useCallback((bredder: Record<string, number>) => {
    setKolonneBredder(bredder);
    lagreBredder(bredder);
  }, []);

  // Kolonnedefinisjoner
  const kolonneDefinisjoner = useMemo(() => {
    interface KolDef {
      id: string; header: string; celle: (rad: SjekklisteRad) => JSX.Element;
      bredde?: string; sorterbar?: boolean; sorterVerdi?: (rad: SjekklisteRad) => string | number | null;
      filtrerbar?: boolean; filterAlternativer?: { value: string; label: string }[];
    }
    const defs: Record<string, KolDef> = {
      prefix: { id: "prefix", header: t("tabell.prefix"),
        celle: (rad) => rad.template?.prefix
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{rad.template.prefix}</span>
          : <span className="text-gray-300">—</span>,
        bredde: "70px", sorterbar: true, sorterVerdi: (rad) => rad.template?.prefix ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.prefix ?? [] },
      nr: { id: "nr", header: t("tabell.nr"),
        celle: (rad) => <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formaterLopenummer(rad)}</span>,
        bredde: "60px", sorterbar: true, sorterVerdi: (rad) => rad.number ?? 0 },
      tittel: { id: "tittel", header: t("tabell.tittel"), celle: (rad) => <span className="font-medium text-gray-900">{rad.title}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.title },
      emne: { id: "emne", header: t("tabell.emne"), celle: (rad) => rad.subject
        ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{rad.subject}</span>
        : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.subject ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.emne ?? [] },
      status: { id: "status", header: t("tabell.status"), celle: (rad) => <StatusBadge status={rad.status} />,
        bredde: "130px", sorterbar: true, sorterVerdi: (rad) => rad.status, filtrerbar: true, filterAlternativer: dynamiskFilter.status ?? [] },
      ansvarlig: { id: "ansvarlig", header: t("tabell.ansvarlig"), celle: (rad) => <span className="text-gray-600">{formaterAnsvarlig(rad)}</span>,
        sorterbar: true, sorterVerdi: (rad) => formaterAnsvarlig(rad), filtrerbar: true, filterAlternativer: dynamiskFilter.ansvarlig ?? [] },
      opprettetAv: { id: "opprettetAv", header: t("tabell.opprettetAv"), celle: (rad) => rad.bestiller?.name
        ? <span className="text-gray-600">{rad.bestiller.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.bestiller?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.opprettetAv ?? [] },
      bestillerEntreprise: { id: "bestillerEntreprise", header: t("tabell.bestillerEntreprise"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.bestillerEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.bestillerEnterprise.name, filtrerbar: true, filterAlternativer: dynamiskFilter.bestillerEntreprise ?? [] },
      utforerEntreprise: { id: "utforerEntreprise", header: t("tabell.utforerEntreprise"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.utforerEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.utforerEnterprise.name, filtrerbar: true, filterAlternativer: dynamiskFilter.utforerEntreprise ?? [] },
      mal: { id: "mal", header: t("tabell.mal"), celle: (rad) => <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{rad.template.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.template.name, filtrerbar: true, filterAlternativer: dynamiskFilter.mal ?? [] },
      opprettet: { id: "opprettet", header: t("tabell.opprettelsesdato"), celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.createdAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.createdAt).getTime() },
      endret: { id: "endret", header: t("tabell.endringsdato"), celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.updatedAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.updatedAt).getTime() },
      frist: { id: "frist", header: t("tabell.tidsfrist"), celle: (rad) => rad.dueDate
        ? <span className="text-xs text-gray-500">{formaterDato(rad.dueDate)}</span> : <span className="text-gray-300">—</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => rad.dueDate ? new Date(rad.dueDate).getTime() : null },
      flyt: { id: "flyt", header: t("tabell.flyt"),
        celle: (rad) => <FlytIndikator
          medlemmer={rad.dokumentflyt?.medlemmer ?? []}
          recipientUserId={rad.recipientUser?.id}
          recipientGroupId={rad.recipientGroup?.id}
          status={rad.status}
          bestillerUserId={rad.bestillerUserId}
        />,
        bredde: "200px", sorterbar: true, sorterVerdi: (rad) => hentFlytLedd(rad),
        filtrerbar: true, filterAlternativer: dynamiskFilter.flyt ?? [] },
      bygning: { id: "bygning", header: t("tabell.bygning"), celle: (rad) => rad.byggeplass?.name
        ? <span className="text-xs text-gray-600">{rad.byggeplass.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.byggeplass?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.bygning ?? [] },
      etasje: { id: "etasje", header: t("tabell.etasje"), celle: (rad) => rad.drawing?.floor
        ? <span className="text-xs text-gray-600">{rad.drawing.floor}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.floor ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.etasje ?? [] },
      tegning: { id: "tegning", header: t("tabell.tegning"), celle: (rad) => rad.drawing?.name
        ? <span className="text-xs text-gray-600">{rad.drawing.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.tegning ?? [] },
    };
    // Dynamiske verdier
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      const type = objektTyper.get(objektId);
      defs[felt.id] = {
        id: felt.id, header: felt.navn ?? felt.id,
        celle: (rad) => { const v = hentFeltVerdi(rad, objektId, type, navneLookup); return v !== "—" ? <span className="text-xs text-gray-600">{v}</span> : <span className="text-gray-300">—</span>; },
        sorterbar: true, sorterVerdi: (rad) => hentFeltVerdi(rad, objektId, type, navneLookup),
        filtrerbar: (dynamiskFilter[felt.id]?.length ?? 0) > 0, filterAlternativer: dynamiskFilter[felt.id] ?? [],
      };
    }
    const rekkefølge = [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter];
    const resultat: KolDef[] = [];
    for (const k of rekkefølge) { const def = defs[k.id]; if (aktiveKolonner.has(k.id) && def) resultat.push(def); }
    return resultat;
  }, [aktiveKolonner, dynamiskFilter, verdiFelter, t]);

  const aktiveFilter = Object.entries(filterVerdier).filter(([_, v]) => v);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="pt-6">
      {(sjekklister?.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setVisKolonneVelger(!visKolonneVelger)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Search className="h-3.5 w-3.5" /> {t("kolonne.velgParameter")}
            </button>
            <KolonneVelger apen={visKolonneVelger} onLukk={() => setVisKolonneVelger(false)}
              aktive={aktiveKolonner} onToggle={handleToggleKolonne} verdiFelter={verdiFelter} />
          </div>
          {aktiveFilter.map(([kolId, verdi]) => {
            const kol = alleKolonner.find((k) => k.id === kolId);
            const kolNavn = kol?.navnKey ? t(kol.navnKey) : (kol?.navn ?? kolId);
            return (
              <span key={kolId} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {kolNavn}: {verdi}
                <button onClick={() => handleFilterEndring(kolId, "")} className="ml-0.5 text-blue-500 hover:text-blue-800">×</button>
              </span>
            );
          })}
          {aktiveFilter.length > 1 && (
            <button onClick={() => setFilterVerdier({})} className="text-xs text-gray-400 hover:text-gray-600">{t("handling.nullstill")}</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtrerte.length} av {sjekklister?.length ?? 0}</span>
        </div>
      )}

      {!sjekklister?.length ? (
        <EmptyState title={t("sjekklister.ingen")} description={t("sjekklister.ingenBeskrivelse")}
          action={<Button onClick={() => setVisModal(true)}>{t("sjekklister.opprett")}</Button>} />
      ) : (
        <Table<SjekklisteRad>
          kolonner={kolonneDefinisjoner} data={filtrerte} radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
          tomMelding={t("sjekklister.ingenMatcherFilter")} velgbar valgteRader={valgte} onValgEndring={setValgte}
          filterVerdier={filterVerdier} onFilterEndring={handleFilterEndring}
          kolonneBredder={kolonneBredder} onKolonneBreddeEndring={handleBreddeEndring} />
      )}

      <Modal open={visSlettModal} onClose={() => setVisSlettModal(false)} title={t("sjekklister.slettTittel")}>
        <div className="flex flex-col gap-4">
          <p className="text-gray-600">Er du sikker på at du vil slette {valgte.size} sjekkliste(r)? Denne handlingen kan ikke angres.</p>
          {slettFeil && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{slettFeil}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="danger" onClick={slettValgte} loading={slettMutation.isPending}>{t("handling.slett")}</Button>
            <Button variant="secondary" onClick={() => setVisSlettModal(false)}>{t("handling.avbryt")}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={visModal} onClose={() => setVisModal(false)} title={t("sjekklister.velgMal")}>
        <div className="space-y-1">
          {sjekklisteMaler.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t("sjekklister.ingenMaler")}</p>
          ) : sjekklisteMaler.map((m: { id: string; name: string; prefix?: string }) => (
            <button key={m.id} onClick={() => handleOpprettFraMal(m.id)} disabled={opprettMutation.isPending}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50">
              <span className="text-sm font-medium text-gray-800">{m.name}</span>
              {m.prefix && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{m.prefix}</span>}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
