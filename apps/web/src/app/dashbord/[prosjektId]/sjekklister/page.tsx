"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useBygning } from "@/kontekst/bygning-kontekst";
import type { VerktoylinjeHandling } from "@/kontekst/navigasjon-kontekst";
import { Plus, Printer, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";

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
  creator: { name: string | null } | null;
  creatorEnterprise: { name: string };
  responderEnterprise: { name: string };
  building: { id: string; name: string } | null;
  drawing: { name: string; floor: string | null } | null;
  recipientUser: { name: string | null } | null;
  recipientGroup: { name: string } | null;
}

// --- Konstanter ---

const STATUS_ALTERNATIVER = [
  { value: "draft", label: "Utkast" },
  { value: "sent", label: "Sendt" },
  { value: "received", label: "Mottatt" },
  { value: "in_progress", label: "Under arbeid" },
  { value: "responded", label: "Besvart" },
  { value: "approved", label: "Godkjent" },
  { value: "rejected", label: "Avvist" },
  { value: "closed", label: "Lukket" },
  { value: "cancelled", label: "Avbrutt" },
];

const FILTRERBARE_TYPER = new Set([
  "list_single", "list_multi", "traffic_light",
  "text_field", "integer", "decimal",
  "date", "date_time", "person", "company",
]);

interface KolonneParam {
  id: string;
  navn: string;
  gruppe: "kolonner" | "posisjon" | "verdier";
  fast?: boolean;
}

const SYSTEM_KOLONNER: KolonneParam[] = [
  { id: "nr", navn: "Nr", gruppe: "kolonner", fast: true },
  { id: "tittel", navn: "Tittel", gruppe: "kolonner", fast: true },
  { id: "status", navn: "Status", gruppe: "kolonner", fast: true },
  { id: "emne", navn: "Emne", gruppe: "kolonner" },
  { id: "ansvarlig", navn: "Ansvarlig", gruppe: "kolonner" },
  { id: "opprettetAv", navn: "Opprettet av", gruppe: "kolonner" },
  { id: "oppretterEntreprise", navn: "Oppretter-entreprise", gruppe: "kolonner" },
  { id: "svarerEntreprise", navn: "Svarer-entreprise", gruppe: "kolonner" },
  { id: "mal", navn: "Mal", gruppe: "kolonner" },
  { id: "opprettet", navn: "Opprettelsesdato", gruppe: "kolonner" },
  { id: "endret", navn: "Endringsdato", gruppe: "kolonner" },
  { id: "frist", navn: "Tidsfrist", gruppe: "kolonner" },
];

const POSISJON_KOLONNER: KolonneParam[] = [
  { id: "bygning", navn: "Bygning", gruppe: "posisjon" },
  { id: "etasje", navn: "Etasje", gruppe: "posisjon" },
  { id: "tegning", navn: "Tegning", gruppe: "posisjon" },
];

const STANDARD_AKTIVE = new Set(["nr", "tittel", "emne", "mal", "status", "ansvarlig", "frist"]);
const STORAGE_KEY = "sitedoc-sjekkliste-kolonner-v3";

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

// --- Hjelpefunksjoner ---

function formaterNummer(rad: SjekklisteRad): string {
  if (rad.template?.prefix && rad.number) {
    return `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`;
  }
  return rad.number ? String(rad.number) : "—";
}

function formaterAnsvarlig(rad: SjekklisteRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  return rad.responderEnterprise.name;
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function hentFeltVerdi(rad: SjekklisteRad, objektId: string): string {
  if (!rad.data) return "—";
  const verdi = rad.data[objektId];
  if (verdi == null || verdi === "") return "—";
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

  const sokLower = sok.toLowerCase();
  const filtrer = (p: KolonneParam) => !sok || p.navn.toLowerCase().includes(sokLower);
  const grupper = [
    { id: "kolonner", navn: "Kolonner", felter: SYSTEM_KOLONNER.filter((k) => !k.fast).filter(filtrer) },
    { id: "posisjon", navn: "Posisjon", felter: POSISJON_KOLONNER.filter(filtrer) },
    { id: "verdier", navn: "Verdier", felter: verdiFelter.filter(filtrer) },
  ].filter((g) => g.felter.length > 0);

  const toggleGruppe = (id: string) => {
    setApneGrupper((prev) => { const ny = new Set(prev); ny.has(id) ? ny.delete(id) : ny.add(id); return ny; });
  };

  return (
    <div ref={ref} className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input type="text" value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Søk..."
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
                <span className="truncate">{felt.navn}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
        <button onClick={() => onToggle("__reset__")} className="text-xs text-gray-500 hover:text-gray-700">Nullstill</button>
        <button onClick={onLukk} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">OK</button>
      </div>
    </div>
  );
}

// --- Hovedkomponent ---

export default function SjekklisteSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const { aktivBygning, standardTegning } = useBygning();
  const [visModal, setVisModal] = useState(false);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visSlettModal, setVisSlettModal] = useState(false);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<Set<string>>(hentLagredeKolonner);
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});

  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.prosjektId, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
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
      creatorEnterpriseId: oppretter.id,
      responderEnterpriseId: svarer?.enterprise?.id ?? oppretter.id,
      workflowId: matchDf?.id,
    });
  }

  const verktoylinjeHandlinger = useMemo((): VerktoylinjeHandling[] => {
    const h: VerktoylinjeHandling[] = [
      { id: "ny-sjekkliste", label: "Ny sjekkliste", ikon: <Plus className="h-4 w-4" />, onClick: () => setVisModal(true), variant: "primary" },
    ];
    if (valgte.size > 0) {
      h.push({ id: "skriv-ut-valgte", label: `Skriv ut valgte (${valgte.size})`, ikon: <Printer className="h-4 w-4" />,
        onClick: () => router.push(`/dashbord/${params.prosjektId}/sjekklister/skriv-ut?ider=${Array.from(valgte).join(",")}`), variant: "secondary" });
      h.push({ id: "slett-valgte", label: `Slett (${valgte.size})`, ikon: <Trash2 className="h-4 w-4" />,
        onClick: () => { setSlettFeil(null); setVisSlettModal(true); }, variant: "danger" });
    }
    return h;
    // eslint-disable-next-line
  }, [valgte, params.prosjektId, router, aktivBygning?.id, standardTegning?.id]);

  useVerktoylinje(verktoylinjeHandlinger, [valgte.size, aktivBygning?.id, standardTegning?.id]);

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
    return [...sett.values()].sort((a, b) => a.navn.localeCompare(b.navn, "nb-NO"));
  }, [sjekklister]);

  const alleKolonner = useMemo(() => [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter], [verdiFelter]);

  // Dynamiske filteralternativer
  const dynamiskFilter = useMemo(() => {
    const data = (sjekklister ?? []);
    const bygg = (felter: (string | null | undefined)[]) =>
      [...new Set(felter.filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v }));
    const filter: Record<string, { value: string; label: string }[]> = {
      emne: bygg(data.map((s) => s.subject)),
      ansvarlig: bygg(data.map((s) => formaterAnsvarlig(s))),
      opprettetAv: bygg(data.map((s) => s.creator?.name)),
      oppretterEntreprise: bygg(data.map((s) => s.creatorEnterprise.name)),
      svarerEntreprise: bygg(data.map((s) => s.responderEnterprise.name)),
      mal: bygg(data.map((s) => s.template.name)),
      bygning: bygg(data.map((s) => s.building?.name)),
      etasje: bygg(data.map((s) => s.drawing?.floor)),
      tegning: bygg(data.map((s) => s.drawing?.name)),
      status: STATUS_ALTERNATIVER,
    };
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      filter[felt.id] = bygg(data.map((s) => { const v = hentFeltVerdi(s, objektId); return v === "—" ? null : v; }));
    }
    return filter;
  }, [sjekklister, verdiFelter]);

  // Filtrer
  const filtrerte = useMemo(() => {
    let resultat = (sjekklister ?? []);
    if (statusFilter) resultat = resultat.filter((s) => s.status === statusFilter);
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      resultat = resultat.filter((s) => {
        if (kolId.startsWith("felt:")) return hentFeltVerdi(s, kolId.replace("felt:", "")) === verdi;
        switch (kolId) {
          case "status": return s.status === verdi;
          case "emne": return s.subject === verdi;
          case "ansvarlig": return formaterAnsvarlig(s) === verdi;
          case "opprettetAv": return s.creator?.name === verdi;
          case "oppretterEntreprise": return s.creatorEnterprise.name === verdi;
          case "svarerEntreprise": return s.responderEnterprise.name === verdi;
          case "mal": return s.template.name === verdi;
          case "bygning": return s.building?.name === verdi;
          case "etasje": return s.drawing?.floor === verdi;
          case "tegning": return s.drawing?.name === verdi;
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

  // Kolonnedefinisjoner
  const kolonneDefinisjoner = useMemo(() => {
    interface KolDef {
      id: string; header: string; celle: (rad: SjekklisteRad) => JSX.Element;
      bredde?: string; sorterbar?: boolean; sorterVerdi?: (rad: SjekklisteRad) => string | number | null;
      filtrerbar?: boolean; filterAlternativer?: { value: string; label: string }[];
    }
    const defs: Record<string, KolDef> = {
      nr: { id: "nr", header: "Nr", celle: (rad) => <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formaterNummer(rad)}</span>,
        bredde: "90px", sorterbar: true, sorterVerdi: (rad) => rad.number ?? 0 },
      tittel: { id: "tittel", header: "Tittel", celle: (rad) => <span className="font-medium text-gray-900">{rad.title}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.title },
      emne: { id: "emne", header: "Emne", celle: (rad) => rad.subject
        ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{rad.subject}</span>
        : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.subject ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.emne ?? [] },
      status: { id: "status", header: "Status", celle: (rad) => <StatusBadge status={rad.status} />,
        bredde: "130px", sorterbar: true, sorterVerdi: (rad) => rad.status, filtrerbar: true, filterAlternativer: dynamiskFilter.status ?? [] },
      ansvarlig: { id: "ansvarlig", header: "Ansvarlig", celle: (rad) => <span className="text-gray-600">{formaterAnsvarlig(rad)}</span>,
        sorterbar: true, sorterVerdi: (rad) => formaterAnsvarlig(rad), filtrerbar: true, filterAlternativer: dynamiskFilter.ansvarlig ?? [] },
      opprettetAv: { id: "opprettetAv", header: "Opprettet av", celle: (rad) => rad.creator?.name
        ? <span className="text-gray-600">{rad.creator.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.creator?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.opprettetAv ?? [] },
      oppretterEntreprise: { id: "oppretterEntreprise", header: "Oppretter-entreprise",
        celle: (rad) => <span className="text-xs text-gray-500">{rad.creatorEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.creatorEnterprise.name, filtrerbar: true, filterAlternativer: dynamiskFilter.oppretterEntreprise ?? [] },
      svarerEntreprise: { id: "svarerEntreprise", header: "Svarer-entreprise",
        celle: (rad) => <span className="text-xs text-gray-500">{rad.responderEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.responderEnterprise.name, filtrerbar: true, filterAlternativer: dynamiskFilter.svarerEntreprise ?? [] },
      mal: { id: "mal", header: "Mal", celle: (rad) => <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{rad.template.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.template.name, filtrerbar: true, filterAlternativer: dynamiskFilter.mal ?? [] },
      opprettet: { id: "opprettet", header: "Opprettet", celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.createdAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.createdAt).getTime() },
      endret: { id: "endret", header: "Sist endret", celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.updatedAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.updatedAt).getTime() },
      frist: { id: "frist", header: "Frist", celle: (rad) => rad.dueDate
        ? <span className="text-xs text-gray-500">{formaterDato(rad.dueDate)}</span> : <span className="text-gray-300">—</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => rad.dueDate ? new Date(rad.dueDate).getTime() : null },
      bygning: { id: "bygning", header: "Bygning", celle: (rad) => rad.building?.name
        ? <span className="text-xs text-gray-600">{rad.building.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.building?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.bygning ?? [] },
      etasje: { id: "etasje", header: "Etasje", celle: (rad) => rad.drawing?.floor
        ? <span className="text-xs text-gray-600">{rad.drawing.floor}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.floor ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.etasje ?? [] },
      tegning: { id: "tegning", header: "Tegning", celle: (rad) => rad.drawing?.name
        ? <span className="text-xs text-gray-600">{rad.drawing.name}</span> : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.name ?? "", filtrerbar: true, filterAlternativer: dynamiskFilter.tegning ?? [] },
    };
    // Dynamiske verdier
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      defs[felt.id] = {
        id: felt.id, header: felt.navn,
        celle: (rad) => { const v = hentFeltVerdi(rad, objektId); return v !== "—" ? <span className="text-xs text-gray-600">{v}</span> : <span className="text-gray-300">—</span>; },
        sorterbar: true, sorterVerdi: (rad) => hentFeltVerdi(rad, objektId),
        filtrerbar: (dynamiskFilter[felt.id]?.length ?? 0) > 0, filterAlternativer: dynamiskFilter[felt.id] ?? [],
      };
    }
    const rekkefølge = [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter];
    const resultat: KolDef[] = [];
    for (const k of rekkefølge) { const def = defs[k.id]; if (aktiveKolonner.has(k.id) && def) resultat.push(def); }
    return resultat;
  }, [aktiveKolonner, dynamiskFilter, verdiFelter]);

  const aktiveFilter = Object.entries(filterVerdier).filter(([_, v]) => v);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div>
      {(sjekklister?.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setVisKolonneVelger(!visKolonneVelger)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Search className="h-3.5 w-3.5" /> Velg parameter
            </button>
            <KolonneVelger apen={visKolonneVelger} onLukk={() => setVisKolonneVelger(false)}
              aktive={aktiveKolonner} onToggle={handleToggleKolonne} verdiFelter={verdiFelter} />
          </div>
          {aktiveFilter.map(([kolId, verdi]) => {
            const kolNavn = alleKolonner.find((k) => k.id === kolId)?.navn ?? kolId;
            return (
              <span key={kolId} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {kolNavn}: {verdi}
                <button onClick={() => handleFilterEndring(kolId, "")} className="ml-0.5 text-blue-500 hover:text-blue-800">×</button>
              </span>
            );
          })}
          {aktiveFilter.length > 1 && (
            <button onClick={() => setFilterVerdier({})} className="text-xs text-gray-400 hover:text-gray-600">Nullstill</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtrerte.length} av {sjekklister?.length ?? 0}</span>
        </div>
      )}

      {!sjekklister?.length ? (
        <EmptyState title="Ingen sjekklister" description="Opprett en sjekkliste basert på en rapportmal."
          action={<Button onClick={() => setVisModal(true)}>Opprett sjekkliste</Button>} />
      ) : (
        <Table<SjekklisteRad>
          kolonner={kolonneDefinisjoner} data={filtrerte} radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
          tomMelding="Ingen sjekklister matcher filtrene" velgbar valgteRader={valgte} onValgEndring={setValgte}
          filterVerdier={filterVerdier} onFilterEndring={handleFilterEndring} />
      )}

      <Modal open={visSlettModal} onClose={() => setVisSlettModal(false)} title="Slett sjekkliste(r)?">
        <div className="flex flex-col gap-4">
          <p className="text-gray-600">Er du sikker på at du vil slette {valgte.size} sjekkliste(r)? Denne handlingen kan ikke angres.</p>
          {slettFeil && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{slettFeil}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="danger" onClick={slettValgte} loading={slettMutation.isPending}>Slett</Button>
            <Button variant="secondary" onClick={() => setVisSlettModal(false)}>Avbryt</Button>
          </div>
        </div>
      </Modal>

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Velg sjekklistemal">
        <div className="space-y-1">
          {sjekklisteMaler.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Ingen sjekklistemaler tilgjengelig</p>
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
