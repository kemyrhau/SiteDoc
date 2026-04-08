"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Badge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import { FlytIndikator } from "@/components/FlytIndikator";

// --- Typer ---

interface OppgaveRad {
  id: string;
  title: string;
  subject: string | null;
  number: number | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown> | null;
  template: { id: string; prefix: string | null; name: string; objects: MalObjekt[] } | null;
  bestiller: { name: string | null } | null;
  bestillerEnterprise: { name: string };
  utforerEnterprise: { name: string };
  drawing: { name: string; floor: string | null; byggeplass: { id: string; name: string } | null } | null;
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

interface MalObjekt {
  id: string;
  label: string;
  type: string;
  config: Record<string, unknown> | null;
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

const PRIORITETER = [
  { value: "low", labelKey: "prioritet.lav" },
  { value: "medium", labelKey: "prioritet.middels" },
  { value: "high", labelKey: "prioritet.hoey" },
  { value: "critical", labelKey: "prioritet.kritisk" },
];

const prioritetFarge: Record<string, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  critical: "danger",
};

// Felttyper som kan filtreres/vises som kolonner
const FILTRERBARE_TYPER = new Set([
  "list_single", "list_multi", "traffic_light",
  "text_field", "integer", "decimal",
  "date", "date_time", "person", "company",
]);

// --- Kolonnegrupper (Dalux-stil) ---

interface KolonneParam {
  id: string;
  navn: string;
  navnKey?: string;
  gruppe: "kolonner" | "posisjon" | "verdier";
  fast?: boolean;
}

const SYSTEM_KOLONNER: KolonneParam[] = [
  { id: "nr", navn: "Nr", navnKey: "tabell.nr", gruppe: "kolonner", fast: true },
  { id: "tittel", navn: "Tittel", navnKey: "tabell.tittel", gruppe: "kolonner", fast: true },
  { id: "status", navn: "Status", navnKey: "tabell.status", gruppe: "kolonner", fast: true },
  { id: "emne", navn: "Emne", navnKey: "tabell.emne", gruppe: "kolonner" },
  { id: "prioritet", navn: "Prioritet", navnKey: "tabell.prioritet", gruppe: "kolonner" },
  { id: "ansvarlig", navn: "Ansvarlig", navnKey: "tabell.ansvarlig", gruppe: "kolonner" },
  { id: "opprettetAv", navn: "Opprettet av", navnKey: "tabell.opprettetAv", gruppe: "kolonner" },
  { id: "bestillerEntreprise", navn: "Bestiller-entreprise", navnKey: "tabell.bestillerEntreprise", gruppe: "kolonner" },
  { id: "utforerEntreprise", navn: "Utfører-entreprise", navnKey: "tabell.utforerEntreprise", gruppe: "kolonner" },
  { id: "dokumentflyt", navn: "Dokumentflyt", navnKey: "tabell.dokumentflyt", gruppe: "kolonner" },
  { id: "mal", navn: "Mal", navnKey: "tabell.mal", gruppe: "kolonner" },
  { id: "opprettet", navn: "Opprettelsesdato", navnKey: "tabell.opprettelsesdato", gruppe: "kolonner" },
  { id: "endret", navn: "Endringsdato", navnKey: "tabell.endringsdato", gruppe: "kolonner" },
  { id: "frist", navn: "Tidsfrist", navnKey: "tabell.tidsfrist", gruppe: "kolonner" },
  { id: "flyt", navn: "Flyt", navnKey: "tabell.flyt", gruppe: "kolonner" },
];

const POSISJON_KOLONNER: KolonneParam[] = [
  { id: "bygning", navn: "Bygning", navnKey: "tabell.bygning", gruppe: "posisjon" },
  { id: "etasje", navn: "Etasje", navnKey: "tabell.etasje", gruppe: "posisjon" },
  { id: "tegning", navn: "Tegning", navnKey: "tabell.tegning", gruppe: "posisjon" },
];

const STANDARD_AKTIVE = new Set(["nr", "tittel", "emne", "status", "ansvarlig", "flyt", "bygning", "frist"]);
const STORAGE_KEY = "sitedoc-oppgave-kolonner-v4";

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

function formaterNummer(rad: OppgaveRad): string {
  if (rad.template?.prefix && rad.number) {
    return `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`;
  }
  return rad.number ? String(rad.number) : "—";
}

function formaterAnsvarlig(rad: OppgaveRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  return rad.utforerEnterprise.name;
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function hentFeltVerdi(rad: OppgaveRad, objektId: string): string {
  if (!rad.data) return "—";
  const verdi = rad.data[objektId];
  if (verdi == null || verdi === "") return "—";
  if (typeof verdi === "string") return verdi;
  if (typeof verdi === "number") return String(verdi);
  if (typeof verdi === "boolean") return verdi ? "Ja" : "Nei";
  if (Array.isArray(verdi)) return verdi.map(String).join(", ");
  return String(verdi);
}

// --- KolonneVelger (Dalux-stil modal) ---

function KolonneVelger({
  apen,
  onLukk,
  aktive,
  onToggle,
  verdiFelter,
}: {
  apen: boolean;
  onLukk: () => void;
  aktive: Set<string>;
  onToggle: (id: string) => void;
  verdiFelter: KolonneParam[];
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

  const sokLower = sok.toLowerCase();
  const hentNavn = (p: KolonneParam) => p.navnKey ? t(p.navnKey) : p.navn;
  const filtrer = (p: KolonneParam) => !sok || hentNavn(p).toLowerCase().includes(sokLower);

  const grupper = [
    { id: "kolonner", navn: t("kolonne.kolonner"), felter: SYSTEM_KOLONNER.filter((k) => k.navn && !k.fast).filter(filtrer) },
    { id: "posisjon", navn: t("kolonne.posisjon"), felter: POSISJON_KOLONNER.filter(filtrer) },
    { id: "verdier", navn: t("kolonne.verdier"), felter: verdiFelter.filter(filtrer) },
  ].filter((g) => g.felter.length > 0);

  const toggleGruppe = (id: string) => {
    setApneGrupper((prev) => {
      const ny = new Set(prev);
      ny.has(id) ? ny.delete(id) : ny.add(id);
      return ny;
    });
  };

  return (
    <div ref={ref} className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder={t("oppgaver.sokPlaceholder")}
            className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto px-1 pb-2">
        {grupper.map((gruppe) => (
          <div key={gruppe.id}>
            <button
              onClick={() => toggleGruppe(gruppe.id)}
              className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {apneGrupper.has(gruppe.id)
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />
              }
              {gruppe.navn}
            </button>
            {apneGrupper.has(gruppe.id) && gruppe.felter.map((felt) => (
              <label
                key={felt.id}
                className="flex cursor-pointer items-center gap-2 py-1 pl-6 pr-2 text-xs hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={aktive.has(felt.id)}
                  onChange={() => onToggle(felt.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                />
                <span className="truncate">{felt.navnKey ? t(felt.navnKey) : felt.navn}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
        <button
          onClick={() => {
            const ny = new Set(STANDARD_AKTIVE);
            lagreKolonner(ny);
            // Reset via parent
            onToggle("__reset__");
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {t("handling.nullstill")}
        </button>
        <button onClick={onLukk} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
          {t("handling.ok")}
        </button>
      </div>
    </div>
  );
}

// --- Hovedkomponent ---

export default function OppgaverSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<Set<string>>(hentLagredeKolonner);
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const { aktivByggeplass } = useByggeplass();

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );
  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;
  const isLoading = oppgaveQuery.isLoading;

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const oppgaveMaler = ((maler ?? []) as Array<{ id: string; name: string; prefix?: string | null; category: string }>).filter((m) => m.category === "oppgave");
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
  );
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      router.push(`/dashbord/${params.prosjektId}/oppgaver/${resultat.id}`);
    },
  });

  useVerktoylinje([
    {
      id: "ny-oppgave",
      label: t("oppgaver.ny"),
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

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
      df.medlemmer.some((m) =>
        m.rolle === "oppretter" && (m.enterprise?.id === oppretter.id || m.group || m.projectMember),
      ),
    );
    const svarer = matchDf?.medlemmer.find((m) => m.rolle === "svarer");
    const svarerEntrepriseId = svarer?.enterprise?.id ?? oppretter.id;

    const mal = oppgaveMaler.find((m) => m.id === malId);
    opprettMutation.mutate({
      templateId: malId,
      bestillerEnterpriseId: oppretter.id,
      utforerEnterpriseId: svarerEntrepriseId,
      title: mal?.name ?? "Ny oppgave",
      priority: "medium",
      dokumentflytId: matchDf?.id,
    });
  }

  // Trekk ut Verdier-kolonner fra alle maler brukt i data
  const verdiFelter = useMemo<KolonneParam[]>(() => {
    if (!oppgaver) return [];
    const sett = new Map<string, KolonneParam>();
    for (const rad of oppgaver) {
      if (!rad.template?.objects) continue;
      for (const obj of rad.template.objects) {
        if (FILTRERBARE_TYPER.has(obj.type) && !sett.has(obj.id)) {
          sett.set(obj.id, { id: `felt:${obj.id}`, navn: obj.label, gruppe: "verdier" });
        }
      }
    }
    return [...sett.values()].sort((a, b) => a.navn.localeCompare(b.navn, "nb-NO"));
  }, [oppgaver]);

  // Alle tilgjengelige kolonner
  const alleKolonner = useMemo(() => [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter], [verdiFelter]);

  // Utled aktivt flyt-ledd for en rad (for filter/sortering)
  const hentFlytLedd = useCallback((rad: OppgaveRad): string => {
    const medl = rad.dokumentflyt?.medlemmer;
    if (!medl || medl.length === 0) return "";
    if (rad.status === "closed" || rad.status === "approved") return "";
    const recipientGroupId = rad.recipientGroup?.id;
    const recipientUserId = rad.recipientUser?.id;
    for (const m of medl) {
      if (recipientGroupId && m.group?.id === recipientGroupId) return m.group.name;
      if (recipientUserId && m.projectMember?.user?.id === recipientUserId) return m.projectMember.user.name ?? "";
    }
    const ent = medl.find((m) => m.enterprise);
    if (ent?.enterprise) return ent.enterprise.name;
    return "";
  }, []);

  // Dynamiske filteralternativer
  const dynamiskFilter = useMemo(() => {
    if (!oppgaver) return {} as Record<string, { value: string; label: string }[]>;
    const bygg = (felter: (string | null | undefined)[]) =>
      [...new Set(felter.filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v }));

    const filter: Record<string, { value: string; label: string }[]> = {
      emne: bygg(oppgaver.map((o) => o.subject)),
      ansvarlig: bygg(oppgaver.map((o) => formaterAnsvarlig(o))),
      opprettetAv: bygg(oppgaver.map((o) => o.bestiller?.name)),
      bestillerEntreprise: bygg(oppgaver.map((o) => o.bestillerEnterprise.name)),
      utforerEntreprise: bygg(oppgaver.map((o) => o.utforerEnterprise.name)),
      flyt: bygg(oppgaver.map((o) => hentFlytLedd(o))),
      mal: bygg(oppgaver.map((o) => o.template?.name)),
      bygning: bygg(oppgaver.map((o) => o.drawing?.byggeplass?.name)),
      etasje: bygg(oppgaver.map((o) => o.drawing?.floor)),
      tegning: bygg(oppgaver.map((o) => o.drawing?.name)),
      prioritet: PRIORITETER.map((p) => ({ value: p.value, label: t(p.labelKey) })),
      status: STATUS_ALTERNATIVER.map((s) => ({ value: s.value, label: t(s.labelKey) })),
    };

    // Verdier fra data-JSON
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      filter[felt.id] = bygg(oppgaver.map((o) => {
        const v = hentFeltVerdi(o, objektId);
        return v === "—" ? null : v;
      }));
    }

    return filter;
  }, [oppgaver, verdiFelter, t]);

  // Filtrer data
  const filtrerte = useMemo(() => {
    let resultat = oppgaver ?? [];
    if (statusFilter === "avvist") {
      resultat = resultat.filter((o) => o.status === "rejected" || o.status === "cancelled");
    } else if (statusFilter) {
      resultat = resultat.filter((o) => o.status === statusFilter);
    }
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      resultat = resultat.filter((o) => {
        if (kolId.startsWith("felt:")) {
          return hentFeltVerdi(o, kolId.replace("felt:", "")) === verdi;
        }
        switch (kolId) {
          case "status": return o.status === verdi;
          case "emne": return o.subject === verdi;
          case "prioritet": return o.priority === verdi;
          case "ansvarlig": return formaterAnsvarlig(o) === verdi;
          case "opprettetAv": return o.bestiller?.name === verdi;
          case "bestillerEntreprise": return o.bestillerEnterprise.name === verdi;
          case "utforerEntreprise": return o.utforerEnterprise.name === verdi;
          case "mal": return o.template?.name === verdi;
          case "bygning": return o.drawing?.byggeplass?.name === verdi;
          case "etasje": return o.drawing?.floor === verdi;
          case "tegning": return o.drawing?.name === verdi;
          case "flyt": return hentFlytLedd(o) === verdi;
          default: return true;
        }
      });
    }
    return resultat;
  }, [oppgaver, statusFilter, filterVerdier]);

  const handleFilterEndring = useCallback((kolonneId: string, verdi: string) => {
    setFilterVerdier((prev) => ({ ...prev, [kolonneId]: verdi }));
  }, []);

  const handleToggleKolonne = useCallback((id: string) => {
    if (id === "__reset__") {
      setAktiveKolonner(new Set(STANDARD_AKTIVE));
      lagreKolonner(new Set(STANDARD_AKTIVE));
      return;
    }
    setAktiveKolonner((prev) => {
      const ny = new Set(prev);
      ny.has(id) ? ny.delete(id) : ny.add(id);
      lagreKolonner(ny);
      return ny;
    });
  }, []);

  // Bygg kolonnedefinisjoner
  const kolonneDefinisjoner = useMemo(() => {
    type KolDef = Parameters<typeof Table<OppgaveRad>>[0]["kolonner"][number];
    const defs: Record<string, KolDef> = {
      nr: {
        id: "nr", header: t("tabell.nr"),
        celle: (rad) => <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formaterNummer(rad)}</span>,
        bredde: "90px", sorterbar: true, sorterVerdi: (rad) => rad.number ?? 0,
      },
      tittel: {
        id: "tittel", header: t("tabell.tittel"),
        celle: (rad) => <span className="font-medium text-gray-900">{rad.title}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.title,
      },
      emne: {
        id: "emne", header: t("tabell.emne"),
        celle: (rad) => rad.subject
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{rad.subject}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.subject ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.emne ?? [],
      },
      status: {
        id: "status", header: t("tabell.status"),
        celle: (rad) => <StatusBadge status={rad.status} />,
        bredde: "130px", sorterbar: true, sorterVerdi: (rad) => rad.status,
        filtrerbar: true, filterAlternativer: dynamiskFilter.status ?? [],
      },
      prioritet: {
        id: "prioritet", header: t("tabell.prioritet"),
        celle: (rad) => (
          <Badge variant={prioritetFarge[rad.priority] ?? "default"}>
            {(() => { const p = PRIORITETER.find((p) => p.value === rad.priority); return p ? t(p.labelKey) : rad.priority; })()}
          </Badge>
        ),
        bredde: "100px", sorterbar: true,
        sorterVerdi: (rad) => ["low", "medium", "high", "critical"].indexOf(rad.priority),
        filtrerbar: true, filterAlternativer: dynamiskFilter.prioritet ?? [],
      },
      ansvarlig: {
        id: "ansvarlig", header: t("tabell.ansvarlig"),
        celle: (rad) => <span className="text-gray-600">{formaterAnsvarlig(rad)}</span>,
        sorterbar: true, sorterVerdi: (rad) => formaterAnsvarlig(rad),
        filtrerbar: true, filterAlternativer: dynamiskFilter.ansvarlig ?? [],
      },
      opprettetAv: {
        id: "opprettetAv", header: t("tabell.opprettetAv"),
        celle: (rad) => rad.bestiller?.name
          ? <span className="text-gray-600">{rad.bestiller.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.bestiller?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.opprettetAv ?? [],
      },
      bestillerEntreprise: {
        id: "bestillerEntreprise", header: t("tabell.bestillerEntreprise"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.bestillerEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.bestillerEnterprise.name,
        filtrerbar: true, filterAlternativer: dynamiskFilter.bestillerEntreprise ?? [],
      },
      utforerEntreprise: {
        id: "utforerEntreprise", header: t("tabell.utforerEntreprise"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.utforerEnterprise.name}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.utforerEnterprise.name,
        filtrerbar: true, filterAlternativer: dynamiskFilter.utforerEntreprise ?? [],
      },
      mal: {
        id: "mal", header: t("tabell.mal"),
        celle: (rad) => rad.template
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{rad.template.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.template?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.mal ?? [],
      },
      dokumentflyt: {
        id: "dokumentflyt", header: t("tabell.dokumentflyt"),
        celle: () => <span className="text-gray-300">—</span>,
      },
      opprettet: {
        id: "opprettet", header: t("tabell.opprettelsesdato"),
        celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.createdAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.createdAt).getTime(),
      },
      endret: {
        id: "endret", header: t("tabell.endringsdato"),
        celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.updatedAt)}</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => new Date(rad.updatedAt).getTime(),
      },
      frist: {
        id: "frist", header: t("tabell.tidsfrist"),
        celle: (rad) => rad.dueDate
          ? <span className="text-xs text-gray-500">{formaterDato(rad.dueDate)}</span>
          : <span className="text-gray-300">—</span>,
        bredde: "120px", sorterbar: true, sorterVerdi: (rad) => rad.dueDate ? new Date(rad.dueDate).getTime() : null,
      },
      flyt: {
        id: "flyt", header: t("tabell.flyt"),
        celle: (rad) => <FlytIndikator
          medlemmer={rad.dokumentflyt?.medlemmer ?? []}
          recipientUserId={rad.recipientUser?.id}
          recipientGroupId={rad.recipientGroup?.id}
          status={rad.status}
          bestillerUserId={rad.bestillerUserId}
        />,
        bredde: "200px", sorterbar: true, sorterVerdi: (rad) => hentFlytLedd(rad),
        filtrerbar: true, filterAlternativer: dynamiskFilter.flyt ?? [],
      },
      bygning: {
        id: "bygning", header: t("tabell.bygning"),
        celle: (rad) => rad.drawing?.byggeplass?.name
          ? <span className="text-xs text-gray-600">{rad.drawing.byggeplass.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.byggeplass?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.bygning ?? [],
      },
      etasje: {
        id: "etasje", header: t("tabell.etasje"),
        celle: (rad) => rad.drawing?.floor
          ? <span className="text-xs text-gray-600">{rad.drawing.floor}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.floor ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.etasje ?? [],
      },
      tegning: {
        id: "tegning", header: t("tabell.tegning"),
        celle: (rad) => rad.drawing?.name
          ? <span className="text-xs text-gray-600">{rad.drawing.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.drawing?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.tegning ?? [],
      },
    };

    // Dynamiske verdier-kolonner
    for (const felt of verdiFelter) {
      const objektId = felt.id.replace("felt:", "");
      defs[felt.id] = {
        id: felt.id, header: felt.navn,
        celle: (rad) => {
          const v = hentFeltVerdi(rad, objektId);
          return v !== "—"
            ? <span className="text-xs text-gray-600">{v}</span>
            : <span className="text-gray-300">—</span>;
        },
        sorterbar: true, sorterVerdi: (rad) => hentFeltVerdi(rad, objektId),
        filtrerbar: (dynamiskFilter[felt.id]?.length ?? 0) > 0,
        filterAlternativer: dynamiskFilter[felt.id] ?? [],
      };
    }

    // Bygg sortert array fra aktive kolonner
    const rekkefølge = [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter];
    const resultat: KolDef[] = [];
    for (const k of rekkefølge) {
      const def = defs[k.id];
      if (aktiveKolonner.has(k.id) && def) resultat.push(def);
    }
    return resultat;
  }, [aktiveKolonner, dynamiskFilter, verdiFelter, t]);

  // Aktive filter for visning
  const aktiveFilter = Object.entries(filterVerdier).filter(([_, v]) => v);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pt-6">
      {/* Filterbar */}
      {(oppgaver?.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2">
          {/* Kolonnevelger */}
          <div className="relative">
            <button
              onClick={() => setVisKolonneVelger(!visKolonneVelger)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Search className="h-3.5 w-3.5" />
              {t("kolonne.velgParameter")}
            </button>
            <KolonneVelger
              apen={visKolonneVelger}
              onLukk={() => setVisKolonneVelger(false)}
              aktive={aktiveKolonner}
              onToggle={handleToggleKolonne}
              verdiFelter={verdiFelter}
            />
          </div>

          {/* Aktive filter-tags */}
          {aktiveFilter.map(([kolId, verdi]) => {
            const kol = alleKolonner.find((k) => k.id === kolId);
            const kolNavn = kol?.navnKey ? t(kol.navnKey) : (kol?.navn ?? kolId);
            return (
              <span
                key={kolId}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {kolNavn}: {verdi}
                <button
                  onClick={() => handleFilterEndring(kolId, "")}
                  className="ml-0.5 text-blue-500 hover:text-blue-800"
                >×</button>
              </span>
            );
          })}
          {aktiveFilter.length > 1 && (
            <button
              onClick={() => setFilterVerdier({})}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t("handling.nullstill")}
            </button>
          )}

          {/* Antall */}
          <span className="ml-auto text-xs text-gray-400">
            {filtrerte.length} av {oppgaver?.length ?? 0}
          </span>
        </div>
      )}

      {!oppgaver?.length ? (
        <EmptyState
          title={t("oppgaver.ingen")}
          description={t("oppgaver.ingenBeskrivelse")}
          action={<Button onClick={() => setVisModal(true)}>{t("oppgaver.opprett")}</Button>}
        />
      ) : (
        <Table<OppgaveRad>
          kolonner={kolonneDefinisjoner}
          data={filtrerte}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
          tomMelding={t("oppgaver.ingenMatcherFilter")}
          filterVerdier={filterVerdier}
          onFilterEndring={handleFilterEndring}
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title={t("oppgaver.velgMal")}>
        <div className="space-y-1">
          {oppgaveMaler.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t("oppgaver.ingenMaler")}</p>
          ) : (
            oppgaveMaler.map((m) => (
              <button
                key={m.id}
                onClick={() => handleOpprettFraMal(m.id)}
                disabled={opprettMutation.isPending}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
                {m.prefix && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{m.prefix}</span>
                )}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
