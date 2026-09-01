"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Badge, Table } from "@sitedoc/ui";
import { beregnHarBallen } from "@sitedoc/shared";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useSistBrukteMal } from "@/hooks/useSistBrukteMal";
import { Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import { FlytIndikator, hentFlytLedd as hentAktivtLeddNavn } from "@/components/FlytIndikator";
import { OpprettMalVelger } from "@/components/OpprettMalVelger";
import { useTabelloppsett } from "@/hooks/useTabelloppsett";
import { KolonneVelger, type KolonneVelgerGruppe } from "@/components/ui/KolonneVelger";

// --- Typer ---

// P4b-port (2026-08-03): kandidatflyt for en oppgave-mal — flyt brukeren er registrator-medlem av
// og som har malen. Speiler sjekkliste-siden (server-beregnet `opprettbareFlytIder`).
interface FlytKandidat {
  flytId: string;
  flytNavn: string;
  bestillerFaggruppeId: string;
  utforerFaggruppeId: string;
  oppretterNavn: string;
  utforerNavn: string;
}

// Flyt-status for en mal FØR klikk (styrer klikk-oppførsel: auto-bind vs picker).
type MalFlytStatus =
  | { type: "en"; kandidat: FlytKandidat }
  | { type: "flere"; kandidater: FlytKandidat[] }
  | { type: "ingen" };

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
  bestillerFaggruppe: { name: string } | null;
  utforerFaggruppe: { name: string } | null;
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
      faggruppe: { id: string; name: string } | null;
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
  "text_field", "integer", "decimal", "calculation",
  "date", "date_time", "person", "persons", "company",
  "signature",
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
  { id: "prefix", navn: "Prefix", navnKey: "tabell.prefix", gruppe: "kolonner", fast: true },
  { id: "nr", navn: "Nr", navnKey: "tabell.nr", gruppe: "kolonner", fast: true },
  { id: "status", navn: "Status", navnKey: "tabell.status", gruppe: "kolonner", fast: true },
  { id: "tittel", navn: "Tittel", navnKey: "tabell.tittel", gruppe: "kolonner" },
  { id: "emne", navn: "Emne", navnKey: "tabell.emne", gruppe: "kolonner" },
  { id: "prioritet", navn: "Prioritet", navnKey: "tabell.prioritet", gruppe: "kolonner" },
  { id: "ansvarlig", navn: "Ansvarlig", navnKey: "tabell.ansvarlig", gruppe: "kolonner" },
  { id: "opprettetAv", navn: "Opprettet av", navnKey: "tabell.opprettetAv", gruppe: "kolonner" },
  { id: "bestillerFaggruppe", navn: "Bestiller-faggruppe", navnKey: "tabell.bestillerFaggruppe", gruppe: "kolonner" },
  { id: "utforerFaggruppe", navn: "Utfører-faggruppe", navnKey: "tabell.utforerFaggruppe", gruppe: "kolonner" },
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

const STANDARD_AKTIVE = new Set(["prefix", "nr", "emne", "status", "ansvarlig", "flyt", "bygning", "frist"]);

// --- Hjelpefunksjoner ---

function formaterLopenummer(rad: OppgaveRad): string {
  return rad.number ? String(rad.number).padStart(3, "0") : "—";
}

// Ansvarlig = den/de i flyten som har ansvar for å svare ut dokumentet (Kenneth-vedtak
// 2026-08-28). Reell mottaker (person/gruppe) er et ekte ansvar. Et UTKAST er ikke sendt
// og har ingen mottaker → ansvarlig er oppretteren som holder det nå. Ellers (ingen
// mottaker, ikke utkast) er det ingen faktisk ansvarlig ennå → tom («—» i cella). Falt
// FØR tilbake på utforerFaggruppe, som navnga en faggruppe som ennå ikke hadde fått ansvar.
// Tom streng (ikke «—») så filterbyggingen (bygg → Boolean-filter) ikke får en «—»-oppføring.
function formaterAnsvarlig(rad: OppgaveRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  if (rad.status === "draft") return rad.bestiller?.name ?? "";
  return "";
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function hentFeltVerdi(
  rad: OppgaveRad,
  objektId: string,
  objektType?: string,
  navneLookup?: Map<string, string>,
): string {
  if (!rad.data) return "—";
  const verdi = rad.data[objektId];
  if (verdi == null || verdi === "") return "—";

  if (objektType === "signature") return verdi ? "✓" : "—";

  if (objektType === "date" && typeof verdi === "string") {
    try { return new Date(verdi).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }); } catch { return String(verdi); }
  }
  if (objektType === "date_time" && typeof verdi === "string") {
    try { return new Date(verdi).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(verdi); }
  }

  if (objektType === "traffic_light" && typeof verdi === "string") {
    const TRAFIKKLYS: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚪" };
    return TRAFIKKLYS[verdi] ?? verdi;
  }

  if ((objektType === "person" || objektType === "company") && typeof verdi === "string" && navneLookup) {
    return navneLookup.get(verdi) ?? verdi;
  }

  if (objektType === "persons" && Array.isArray(verdi) && navneLookup) {
    return verdi.map((id) => navneLookup.get(String(id)) ?? String(id)).join(", ");
  }

  if (typeof verdi === "string") return verdi;
  if (typeof verdi === "number") return String(verdi);
  if (typeof verdi === "boolean") return verdi ? "Ja" : "Nei";
  if (Array.isArray(verdi)) return verdi.map(String).join(", ");
  return String(verdi);
}

// --- Hovedkomponent ---

export default function OppgaverSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const prioritetFilter = searchParams.get("prioritet");
  const sok = (searchParams.get("sok") ?? "").trim().toLowerCase();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const {
    aktiveKolonner, kolonneBredder,
    handleToggleKolonne, handleBreddeEndring,
  } = useTabelloppsett({
    liste: "oppgaver",
    standardKolonner: STANDARD_AKTIVE,
    migrerNokkel: "sitedoc-oppgave-kolonner-v5",
    migrerBreddeNokkel: "sitedoc-oppgave-bredder-v1",
  });
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [mineOppgaver, setMineOppgaver] = useState(false);
  // Oppgave-opprett tar kun drawingId (oppgave.opprett har ikke byggeplassId —
  // byggeplass utledes via drawing.byggeplassId). Henter standardTegning som
  // kontekst-default (V2); byggeplass-uten-aktiv-tegning kan ikke festes på
  // oppgave uten server-endring (sak B, backlogget).
  const { standardTegning } = useByggeplass();

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );
  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;
  const isLoading = oppgaveQuery.isLoading;

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  // P4b-port (2026-08-03): les `opprettbareFlytIder` (server-beregnet, delt regel med opprett-
  // valideringen) — erstatter den skjøre klient-`matchDf`-heuristikken.
  const oppgaveMaler = ((maler ?? []) as Array<{ id: string; name: string; prefix?: string | null; category: string; domain?: string | null; opprettbar?: boolean; opprettbareFlytIder?: string[] }>).filter((m) => m.category === "oppgave");
  // P4b pkt 0: skill opprettbare fra utilgjengelige (server-feltet, delt regel).
  // Velger + auto-hopp bruker KUN opprettbare; utilgjengelige vises bak «vis (N)».
  const opprettbareOppgaveMaler = oppgaveMaler.filter((m) => m.opprettbar !== false);
  const utilgjengeligeOppgaveMaler = oppgaveMaler.filter((m) => m.opprettbar === false);
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );
  // «Mine oppgaver»-filter (Del 1d): trenger userId + gruppeIder for beregnHarBallen.
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery({ projectId: params.prosjektId });

  // P4b: sist brukt oppgavemal (klient-lokal interim, se useSistBrukteMal).
  // En oppgave-mal KAN ligge i flere dokumentflyter (`DokumentflytMal @@unique([dokumentflytId,
  // templateId])` — kompositt, ikke templateId alene). Per-prosjekt-nøkkelen (`oppgaveMalNøkkel`) er
  // likevel trygg fordi flyt-VALGET alltid re-kjøres i `handleOpprettFraMal` via `malFlytStatus`:
  // sist-brukt gjenåpner bare malen, som deretter auto-binder ved nøyaktig én kandidatflyt eller
  // åpner picker ved flere — nøkkelen ruter aldri blindt til «feil flyt».
  const { sistBrukt, settSistBrukt } = useSistBrukteMal(minFlytInfo?.userId);
  const oppgaveMalNøkkel = `oppgave:${params.prosjektId}`;
  const sisteMalRef = useRef<string | null>(null);
  // P4b pkt 0: utilgjengelige maler skjules som default; åpnes via «vis (N)».
  const [visUtilgjengelige, setVisUtilgjengelige] = useState(false);
  // P4b-port: steg-2 flyt-velger når en mal har flere kandidatflyter (speiler sjekkliste).
  const [flytSteg, setFlytSteg] = useState<{ malId: string; kandidater: FlytKandidat[] } | null>(null);
  const [valgtFlytId, setValgtFlytId] = useState<string | null>(null);

  // @ts-ignore TS2589 — tRPC-output trigger excessively deep instantiation (kjent
  // falsk-positiv, samme mønster som oppgave-detalj); callback bruker _data: unknown.
  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      if (sisteMalRef.current) {
        settSistBrukt(oppgaveMalNøkkel, sisteMalRef.current);
        sisteMalRef.current = null;
      }
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      router.push(`/dashbord/${params.prosjektId}/oppgaver/${resultat.id}`);
    },
    onError: (err) => {
      setVisModal(false);
      alert(t("felles.feilOpprettelse", { melding: err.message }));
    },
  });

  // Verktøylinja registrerer kun ved mount → onClick ville fryse en stale
  // åpneMalVelger (tom mal-liste før data er lastet) og auto-hopp ville aldri
  // utløses. Ref holdes fersk hver render (assign etter definisjonen under).
  const åpneMalVelgerRef = useRef<() => void>(() => {});
  useVerktoylinje([
    {
      id: "ny-oppgave",
      label: t("oppgaver.ny"),
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => åpneMalVelgerRef.current(),
      variant: "primary",
    },
  ]);

  // P4b-port: flyt-status per mal FØR klikk. Opprettbarheten (hvilke flyter brukeren KAN opprette malen
  // under) kommer fra SERVEREN (`mal.opprettbareFlytIder` — delt regel med opprett-valideringen).
  // Klienten bygger kun kandidat-DETALJENE (flyt-navn/faggruppe) for auto-bind/picker. Speiler sjekkliste.
  const malFlytStatus = useMemo(() => {
    const alleDf = (dokumentflyter ?? []) as Array<{
      id: string;
      name: string;
      faggruppeId: string | null;
      faggruppe?: { id: string; name: string } | null;
      medlemmer: Array<{ faggruppe?: { id: string; name?: string } | null; rolle: string }>;
    }>;
    const dfById = new Map(alleDf.map((df) => [df.id, df]));
    const map = new Map<string, MalFlytStatus>();
    for (const mal of oppgaveMaler) {
      const kandidater: FlytKandidat[] = (mal.opprettbareFlytIder ?? [])
        .map((id) => dfById.get(id))
        .filter((df): df is NonNullable<typeof df> => !!df && df.faggruppeId != null)
        .map((df) => {
          const utforer = df.medlemmer.find((m) => m.rolle === "utforer");
          return {
            flytId: df.id,
            flytNavn: df.name,
            bestillerFaggruppeId: df.faggruppeId!,
            utforerFaggruppeId: utforer?.faggruppe?.id ?? df.faggruppeId!,
            oppretterNavn: df.faggruppe?.name ?? "—",
            utforerNavn: utforer?.faggruppe?.name ?? df.faggruppe?.name ?? "—",
          };
        });
      if (kandidater.length === 0) map.set(mal.id, { type: "ingen" });
      else if (kandidater.length === 1) map.set(mal.id, { type: "en", kandidat: kandidater[0]! });
      else map.set(mal.id, { type: "flere", kandidater });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokumentflyter, oppgaveMaler]);

  // Gruppering v2 (2026-08-04, fabel-spec): oppgave-velger GRUPPERT i to nivåer — faggruppe (nivå 1) →
  // dokumentflyt (nivå 2) → mal (nivå 3), speiler sjekkliste (var flat i Funn C). Faggruppe = flytens
  // eier-/bestiller-faggruppe. En mal i flere flyter vises under hver (klikk = løst kandidat → opprett
  // direkte, ingen steg-2 fra grupperingen). Flyt-løse opprettbare HMS-maler (domain=hms, auto-rutes til
  // HMS-gruppen uten flyt) samles i egen nivå-1 «HMS»-seksjon (ALT 1, cowork-vedtak 2026-08-04) —
  // sorteres nederst via `sorterSist`, ingen nivå-2-overskrift. Sortering ellers i OpprettMalVelger.
  const velgerGrupper = useMemo(() => {
    const fagMap = new Map<
      string,
      {
        faggruppeId: string;
        faggruppeNavn: string;
        flyter: Map<string, { flytId: string; flytNavn: string; maler: Array<{ malId: string; malNavn: string; prefix?: string | null; kandidat: FlytKandidat }> }>;
      }
    >();
    const hmsMaler: Array<{ malId: string; malNavn: string; prefix?: string | null }> = [];
    for (const mal of opprettbareOppgaveMaler) {
      // HMS-oppgavemaler: flyt-løse (auto-rutes) → egen nivå-1-seksjon, ikke faggruppe→flyt.
      if (mal.domain === "hms") {
        hmsMaler.push({ malId: mal.id, malNavn: mal.name, prefix: mal.prefix });
        continue;
      }
      const status = malFlytStatus.get(mal.id);
      // Opprettbar ikke-HMS-mal har alltid ≥1 kandidat (server-regel) — vaktklausul for typesnevring.
      if (!status || status.type === "ingen") continue;
      const kandidater = status.type === "en" ? [status.kandidat] : status.kandidater;
      for (const k of kandidater) {
        const fag = fagMap.get(k.bestillerFaggruppeId)
          ?? { faggruppeId: k.bestillerFaggruppeId, faggruppeNavn: k.oppretterNavn, flyter: new Map() };
        const flyt = fag.flyter.get(k.flytId) ?? { flytId: k.flytId, flytNavn: k.flytNavn, maler: [] };
        flyt.maler.push({ malId: mal.id, malNavn: mal.name, prefix: mal.prefix, kandidat: k });
        fag.flyter.set(k.flytId, flyt);
        fagMap.set(k.bestillerFaggruppeId, fag);
      }
    }
    return { faggrupper: Array.from(fagMap.values()), hmsMaler };
  }, [opprettbareOppgaveMaler, malFlytStatus]);

  function opprettMedKandidat(malId: string, k: FlytKandidat) {
    // P4b: husk malen til onSuccess skriver sist-brukt-signalet (interim).
    sisteMalRef.current = malId;
    const navn = ((maler ?? []) as Array<{ id: string; name: string }>).find((m) => m.id === malId)?.name;
    opprettMutation.mutate({
      templateId: malId,
      bestillerFaggruppeId: k.bestillerFaggruppeId,
      utforerFaggruppeId: k.utforerFaggruppeId,
      title: navn ?? t("oppgaver.nyOppgaveFallback"),
      priority: "medium",
      dokumentflytId: k.flytId,
      drawingId: standardTegning?.id,
    });
  }

  function handleOpprettFraMal(malId: string) {
    // Hent malen med domain fra API-data (ikke fra type-castet oppgaveMaler)
    const alleMalerTypet = (maler ?? []) as Array<{ id: string; name: string; domain?: string | null; category: string }>;
    const malMedDomain = alleMalerTypet.find((m) => m.id === malId);

    // HMS-oppgaver: ingen faggruppe, auto-rutes til HMS-gruppen av API (uendret).
    if (malMedDomain?.domain === "hms") {
      sisteMalRef.current = malId;
      opprettMutation.mutate({
        templateId: malId,
        title: malMedDomain.name ?? t("oppgaver.hmsAvvikFallback"),
        priority: "medium",
        drawingId: standardTegning?.id,
      });
      return;
    }

    // P4b-port: bind flyt fra server-beregnet kandidat. Erstatter den skjøre `matchDf`-heuristikken
    // (som brukte de døde rolle-strengene «oppretter»/«svarer»). Nøyaktig én kandidat → auto-bind;
    // flere → steg-2 flyt-velger. Serveren håndhever samme regel (registrator-medlemskap + flytHarMal).
    const status = malFlytStatus.get(malId);
    if (!status || status.type === "ingen") {
      alert(t("dokumentflyt.feil.ingenFlytMedMal"));
      return;
    }
    if (status.type === "en") {
      opprettMedKandidat(malId, status.kandidat);
    } else {
      setFlytSteg({ malId, kandidater: status.kandidater });
      setValgtFlytId(status.kandidater[0]?.flytId ?? null);
      setVisModal(true);
    }
  }

  // Ordre 1.4 (2026-08-05): auto-hopp fjernet OVERALT. 0 opprettbare maler → knappen er
  // deaktivert m/ forklaring (eies utenfor). ≥1 → velgeren vises ALLTID, markør på sist-brukt
  // (ingen → første/eneste rad). Enter oppretter — hurtig-stien er like rask (åpne → Enter).
  // Sist-brukt styrer nå KUN markørens startrad, aldri auto-opprettelse.
  function åpneMalVelger() {
    setVisModal(true);
  }
  // Hold verktøylinje-ref fersk (se useVerktoylinje over).
  åpneMalVelgerRef.current = åpneMalVelger;

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

  // Grupper for den delte kolonnevelgeren (faste kolonner utelates — de er alltid på).
  const kolonneVelgerGrupper = useMemo<KolonneVelgerGruppe[]>(() => {
    const oversett = (p: KolonneParam) => (p.navnKey ? t(p.navnKey) : p.navn);
    return [
      { id: "kolonner", navn: t("kolonne.kolonner"), felter: SYSTEM_KOLONNER.filter((k) => k.navn && !k.fast).map((k) => ({ id: k.id, navn: oversett(k) })) },
      { id: "posisjon", navn: t("kolonne.posisjon"), felter: POSISJON_KOLONNER.map((k) => ({ id: k.id, navn: oversett(k) })) },
      { id: "verdier", navn: t("kolonne.verdier"), felter: verdiFelter.map((k) => ({ id: k.id, navn: oversett(k) })) },
    ].filter((g) => g.felter.length > 0);
  }, [verdiFelter, t]);

  // Alle tilgjengelige kolonner
  // Map objektId → type for spesialformatering
  const objektTyper = useMemo(() => {
    const map = new Map<string, string>();
    for (const rad of oppgaver ?? []) {
      for (const obj of rad.template?.objects ?? []) {
        if (!map.has(obj.id)) map.set(obj.id, obj.type);
      }
    }
    return map;
  }, [oppgaver]);

  // Navne-lookup for person/firma-IDer
  const navneLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const df of dokumentflyter ?? []) {
      for (const m of (df as { medlemmer?: { projectMember?: { user?: { id: string; name: string | null } } | null; faggruppe?: { id: string; name: string } | null }[] }).medlemmer ?? []) {
        if (m.projectMember?.user?.id && m.projectMember.user.name) map.set(m.projectMember.user.id, m.projectMember.user.name);
        if (m.faggruppe?.id && m.faggruppe.name) map.set(m.faggruppe.id, m.faggruppe.name);
      }
    }
    for (const rad of oppgaver ?? []) {
      if (rad.bestiller?.name) map.set((rad as unknown as { bestillerUserId: string }).bestillerUserId ?? "", rad.bestiller.name);
      if (rad.bestillerFaggruppe) map.set((rad as unknown as { bestillerFaggruppeId: string }).bestillerFaggruppeId ?? "", rad.bestillerFaggruppe?.name ?? "");
      if (rad.utforerFaggruppe) map.set((rad as unknown as { utforerFaggruppeId: string }).utforerFaggruppeId ?? "", rad.utforerFaggruppe?.name ?? "");
    }
    return map;
  }, [dokumentflyter, oppgaver]);

  const alleKolonner = useMemo(() => [...SYSTEM_KOLONNER, ...POSISJON_KOLONNER, ...verdiFelter], [verdiFelter]);

  // Utled aktivt flyt-ledd for en rad (for filter/sortering)
  // Fase 4: aktiv boks fra posisjon (server-fakta), ikke recipient-heuristikk.
  const hentFlytLedd = useCallback(
    (rad: OppgaveRad): string =>
      hentAktivtLeddNavn(
        rad.dokumentflyt?.medlemmer ?? [],
        (rad as { aktivPosisjon?: number | null }).aktivPosisjon,
      ),
    [],
  );

  // Dynamiske filteralternativer
  const dynamiskFilter = useMemo(() => {
    if (!oppgaver) return {} as Record<string, { value: string; label: string }[]>;
    const bygg = (felter: (string | null | undefined)[]) =>
      [...new Set(felter.filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v }));

    const filter: Record<string, { value: string; label: string }[]> = {
      prefix: bygg(oppgaver.map((o) => o.template?.prefix)),
      emne: bygg(oppgaver.map((o) => o.subject)),
      ansvarlig: bygg(oppgaver.map((o) => formaterAnsvarlig(o))),
      opprettetAv: bygg(oppgaver.map((o) => o.bestiller?.name)),
      bestillerFaggruppe: bygg(oppgaver.map((o) => o.bestillerFaggruppe?.name ?? "")),
      utforerFaggruppe: bygg(oppgaver.map((o) => o.utforerFaggruppe?.name ?? "")),
      flyt: bygg(oppgaver.map((o) => hentFlytLedd(o))),
      frist: [
        { value: "har_frist", label: t("kontrollplan.frist") },
        { value: "ingen_frist", label: "—" },
        { value: "forfalt", label: t("kontrollplan.statusForfalt") },
      ],
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
      const type = objektTyper.get(objektId);
      filter[felt.id] = bygg(oppgaver.map((o) => {
        const v = hentFeltVerdi(o, objektId, type, navneLookup);
        return v === "—" ? null : v;
      }));
    }

    return filter;
  }, [oppgaver, verdiFelter, t, objektTyper, navneLookup]);

  // Filtrer data
  const filtrerte = useMemo(() => {
    let resultat = oppgaver ?? [];
    if (statusFilter === "avvist") {
      resultat = resultat.filter((o) => o.status === "rejected" || o.status === "cancelled");
    } else if (statusFilter) {
      resultat = resultat.filter((o) => o.status === statusFilter);
    }
    if (prioritetFilter) {
      resultat = resultat.filter((o) => o.priority === prioritetFilter);
    }
    if (sok) {
      resultat = resultat.filter((o) => {
        const lopenummer = `${o.template?.prefix ?? ""}${o.number != null ? String(o.number).padStart(3, "0") : ""}`.toLowerCase();
        return (
          o.title.toLowerCase().includes(sok) ||
          // FASTE FELT Del A#4: emne er søkbart (stikkord om innhold).
          (o.subject != null && o.subject.toLowerCase().includes(sok)) ||
          lopenummer.includes(sok) ||
          (o.number != null && String(o.number).includes(sok))
        );
      });
    }
    // «Mine oppgaver» (Del 1d): behold kun dokumenter der innlogget bruker har ballen.
    if (mineOppgaver && minFlytInfo) {
      resultat = resultat.filter((o) =>
        beregnHarBallen(
          {
            status: o.status,
            bestillerUserId: o.bestillerUserId,
            recipientUserId: o.recipientUser?.id,
            recipientGroupId: o.recipientGroup?.id,
          },
          { userId: minFlytInfo.userId, gruppeIder: minFlytInfo.gruppeIder },
        ),
      );
    }
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      const valgteSet = new Set(verdi.split(","));
      resultat = resultat.filter((o) => {
        if (kolId.startsWith("felt:")) {
          const oid = kolId.replace("felt:", "");
          const feltVerdi = hentFeltVerdi(o, oid, objektTyper.get(oid), navneLookup);
          return valgteSet.has(feltVerdi);
        }
        switch (kolId) {
          case "prefix": return valgteSet.has(o.template?.prefix ?? "");
          case "status": return valgteSet.has(o.status);
          case "emne": return valgteSet.has(o.subject ?? "");
          case "prioritet": return valgteSet.has(o.priority ?? "");
          case "ansvarlig": return valgteSet.has(formaterAnsvarlig(o));
          case "opprettetAv": return valgteSet.has(o.bestiller?.name ?? "");
          case "bestillerFaggruppe": return valgteSet.has(o.bestillerFaggruppe?.name ?? "");
          case "utforerFaggruppe": return valgteSet.has(o.utforerFaggruppe?.name ?? "");
          case "mal": return valgteSet.has(o.template?.name ?? "");
          case "bygning": return valgteSet.has(o.drawing?.byggeplass?.name ?? "");
          case "etasje": return valgteSet.has(o.drawing?.floor ?? "");
          case "tegning": return valgteSet.has(o.drawing?.name ?? "");
          case "flyt": return valgteSet.has(hentFlytLedd(o));
          case "frist": {
            const harFrist = !!o.dueDate;
            const forfalt = harFrist && new Date(o.dueDate!) < new Date() && o.status !== "approved" && o.status !== "closed";
            if (valgteSet.has("forfalt")) return forfalt;
            if (valgteSet.has("har_frist") && valgteSet.has("ingen_frist")) return true;
            if (valgteSet.has("har_frist")) return harFrist;
            if (valgteSet.has("ingen_frist")) return !harFrist;
            return true;
          }
          default: return true;
        }
      });
    }
    return resultat;
  }, [oppgaver, statusFilter, prioritetFilter, sok, filterVerdier, mineOppgaver, minFlytInfo]);

  const handleFilterEndring = useCallback((kolonneId: string, verdi: string) => {
    setFilterVerdier((prev) => ({ ...prev, [kolonneId]: verdi }));
  }, []);

  // Bygg kolonnedefinisjoner
  const kolonneDefinisjoner = useMemo(() => {
    interface KolDef {
      id: string;
      header: string;
      celle: (rad: OppgaveRad) => JSX.Element;
      bredde?: string;
      sorterbar?: boolean;
      sorterVerdi?: (rad: OppgaveRad) => string | number | null;
      filtrerbar?: boolean;
      filterAlternativer?: { value: string; label: string }[];
      filterSnarveier?: { label: string; verdier: string[] }[];
    }
    const defs: Record<string, KolDef> = {
      prefix: {
        id: "prefix", header: t("tabell.prefix"),
        celle: (rad) => rad.template?.prefix
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{rad.template.prefix}</span>
          : <span className="text-gray-300">—</span>,
        bredde: "70px", sorterbar: true, sorterVerdi: (rad) => rad.template?.prefix ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.prefix ?? [],
      },
      nr: {
        id: "nr", header: t("tabell.nr"),
        celle: (rad) => <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formaterLopenummer(rad)}</span>,
        bredde: "60px", sorterbar: true, sorterVerdi: (rad) => rad.number ?? 0,
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
        celle: (rad) => (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={rad.status} />
            {["sent", "received", "in_progress", "responded", "rejected"].includes(rad.status) &&
              (rad.recipientUser?.name || rad.recipientGroup?.name) && (
                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                  {t("tabell.venterPaa")}: {rad.recipientUser?.name ?? rad.recipientGroup?.name}
                </span>
              )}
          </div>
        ),
        bredde: "260px", sorterbar: true, sorterVerdi: (rad) => rad.status,
        filtrerbar: true, filterAlternativer: dynamiskFilter.status ?? [],
        filterSnarveier: [{ label: t("status.alleApne"), verdier: ["draft", "sent", "received", "in_progress", "responded"] }],
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
        celle: (rad) => {
          const ansvarlig = formaterAnsvarlig(rad);
          return ansvarlig
            ? <span className="text-gray-600">{ansvarlig}</span>
            : <span className="text-gray-300">—</span>;
        },
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
      bestillerFaggruppe: {
        id: "bestillerFaggruppe", header: t("tabell.bestillerFaggruppe"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.bestillerFaggruppe?.name ?? ""}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.bestillerFaggruppe?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.bestillerFaggruppe ?? [],
      },
      utforerFaggruppe: {
        id: "utforerFaggruppe", header: t("tabell.utforerFaggruppe"),
        celle: (rad) => <span className="text-xs text-gray-500">{rad.utforerFaggruppe?.name ?? ""}</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.utforerFaggruppe?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.utforerFaggruppe ?? [],
      },
      mal: {
        id: "mal", header: t("tabell.mal"),
        celle: (rad) => rad.template
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{rad.template.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true, sorterVerdi: (rad) => rad.template?.name ?? "",
        filtrerbar: true, filterAlternativer: dynamiskFilter.mal ?? [],
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
        filtrerbar: true, filterAlternativer: dynamiskFilter.frist,
      },
      flyt: {
        id: "flyt", header: t("tabell.flyt"),
        celle: (rad) => <FlytIndikator
          medlemmer={rad.dokumentflyt?.medlemmer ?? []}
          aktivPosisjon={(rad as { aktivPosisjon?: number | null }).aktivPosisjon}
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
      const type = objektTyper.get(objektId);
      defs[felt.id] = {
        id: felt.id, header: felt.navn,
        celle: (rad) => {
          const v = hentFeltVerdi(rad, objektId, type, navneLookup);
          return v !== "—"
            ? <span className="text-xs text-gray-600">{v}</span>
            : <span className="text-gray-300">—</span>;
        },
        sorterbar: true, sorterVerdi: (rad) => hentFeltVerdi(rad, objektId, type, navneLookup),
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
              grupper={kolonneVelgerGrupper}
              sokPlaceholder={t("oppgaver.sokPlaceholder")}
              nullstillTekst={t("handling.nullstill")}
              okTekst={t("handling.ok")}
            />
          </div>

          {/* «Mine oppgaver»-toggle (Del 1d): kun dokumenter der jeg har ballen */}
          <button
            onClick={() => setMineOppgaver((v) => !v)}
            aria-pressed={mineOppgaver}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              mineOppgaver
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("filter.mineOppgaver")}
          </button>

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
          action={<Button onClick={åpneMalVelger}>{t("oppgaver.opprett")}</Button>}
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
          kolonneBredder={kolonneBredder}
          onKolonneBreddeEndring={handleBreddeEndring}
        />
      )}

      <Modal
        open={visModal}
        onClose={() => { setVisModal(false); setFlytSteg(null); setValgtFlytId(null); }}
        title={flytSteg ? t("sjekklister.velgFlyt") : t("oppgaver.velgMal")}
      >
        {flytSteg ? (
          // P4b-port steg 2: flyt-velger når malen har flere kandidatflyter (speiler sjekkliste).
          <div className="space-y-3">
            <div className="space-y-1">
              {flytSteg.kandidater.map((k) => (
                <label key={k.flytId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <input type="radio" name="oppgave-flytvelger" className="mt-1"
                    checked={valgtFlytId === k.flytId} onChange={() => setValgtFlytId(k.flytId)} />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{k.flytNavn}</div>
                    <div className="text-xs text-gray-500">
                      {t("sjekklister.flytOppretter")}: {k.oppretterNavn} · {t("sjekklister.flytUtforer")}: {k.utforerNavn}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <Button data-testid="oppgave-opprett-flyt-bekreft" loading={opprettMutation.isPending} onClick={() => {
                const k = flytSteg.kandidater.find((x) => x.flytId === valgtFlytId);
                if (k) opprettMedKandidat(flytSteg.malId, k);
              }}>{t("handling.opprett")}</Button>
              <Button variant="secondary" onClick={() => { setFlytSteg(null); setValgtFlytId(null); }}>
                {t("handling.tilbake")}
              </Button>
            </div>
          </div>
        ) : oppgaveMaler.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t("oppgaver.ingenMaler")}</p>
        ) : (
          // Gruppering v2: unifisert velger (markør/tastatur/«Opprett»/«Sist brukt»). Oppgave = to-nivå
          // gruppert (faggruppe → flyt) som sjekkliste; hver flyt-rad = løst kandidat → opprett direkte.
          // HMS-maler (flyt-løse) i egen nivå-1-seksjon nederst → handleOpprettFraMal (HMS-grenen auto-ruter).
          <OpprettMalVelger
            grupper={[
              ...velgerGrupper.faggrupper.map((fag) => ({
                key: fag.faggruppeId,
                overskrift: { navn: fag.faggruppeNavn },
                undergrupper: Array.from(fag.flyter.values()).map((flyt) => ({
                  key: flyt.flytId,
                  overskrift: { navn: flyt.flytNavn },
                  maler: flyt.maler.map((m) => ({
                    radKey: `${flyt.flytId}:${m.malId}`,
                    malId: m.malId,
                    malNavn: m.malNavn,
                    prefix: m.prefix,
                    onVelg: () => opprettMedKandidat(m.malId, m.kandidat),
                  })),
                })),
              })),
              ...(velgerGrupper.hmsMaler.length > 0
                ? [{
                    key: "__hms__",
                    overskrift: { navn: t("maler.domain.hms") },
                    sorterSist: true,
                    undergrupper: [{
                      key: "__hms__u",
                      maler: velgerGrupper.hmsMaler.map((m) => ({
                        radKey: `hms:${m.malId}`,
                        malId: m.malId,
                        malNavn: m.malNavn,
                        prefix: m.prefix,
                        onVelg: () => handleOpprettFraMal(m.malId),
                      })),
                    }],
                  }]
                : []),
            ]}
            sistBruktMalId={sistBrukt(oppgaveMalNøkkel)}
            opprettPending={opprettMutation.isPending}
            footer={utilgjengeligeOppgaveMaler.length > 0 ? (
              <div className="border-t border-gray-100 pt-2">
                <button type="button" onClick={() => setVisUtilgjengelige((v) => !v)}
                  className="flex min-h-11 w-full items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600">
                  {visUtilgjengelige ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {t("sjekklister.visUtilgjengelige", { antall: utilgjengeligeOppgaveMaler.length })}
                </button>
                {visUtilgjengelige && utilgjengeligeOppgaveMaler.map((m) => (
                  <div key={m.id} className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 opacity-60">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">{m.name}</span>
                      {m.prefix && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-400">{m.prefix}</span>}
                    </span>
                    <span className="text-xs text-gray-400">{t("dokumentflyt.feil.ingenFlytMedMal")}</span>
                  </div>
                ))}
              </div>
            ) : null}
          />
        )}
      </Modal>
    </div>
  );
}
