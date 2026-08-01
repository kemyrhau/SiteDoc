"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Spinner, StatusBadge, Card } from "@sitedoc/ui";
import { Check, AlertCircle, Loader2, Send, Printer, Pencil } from "lucide-react";
import { FlytIndikator } from "@/components/FlytIndikator";
import { trpc } from "@/lib/trpc";
import { finnMottakerNavn } from "@/lib/videresend-valg";
import { useOppgaveSkjema } from "@/hooks/useOppgaveSkjema";
import { DokumentHandlingsmeny } from "@/components/DokumentHandlingsmeny";
import { HmsHandlingsflate, type HmsHandlingType } from "@/components/HmsHandlingsflate";
import { perspektivEtikett, kvitteringEtikett, harMinstEttUtfyltFelt } from "@sitedoc/shared";
import { useFlytKontekst, type MinFlytInfoUtsnitt } from "@/hooks/useFlytKontekst";
import { LokasjonVelger } from "@/components/LokasjonVelger";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import { UtfyllingSeksjoner } from "@/components/rapportobjekter/UtfyllingSeksjoner";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import { useOversettelse } from "@/hooks/useOversettelse";
import { DokumentTidslinje } from "@/components/DokumentTidslinje";
import { DokumentKontekstChipLinje } from "@/components/kontekst-chip/DokumentKontekstChipLinje";
import { usePresence } from "@/hooks/usePresence";
import { useTranslation } from "react-i18next";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

/* ------------------------------------------------------------------ */
/*  LagreIndikator                                                     */
/* ------------------------------------------------------------------ */

function LagreIndikator({ status }: { status: "idle" | "lagrer" | "lagret" | "feil" }) {
  const { t } = useTranslation();
  if (status === "idle") return null;
  if (status === "lagrer") {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        {t("lagring.lagrer")}
      </span>
    );
  }
  if (status === "lagret") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check size={14} />
        {t("lagring.lagret")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle size={14} />
      {t("lagring.feil")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dialog-seksjon                                                     */
/* ------------------------------------------------------------------ */

interface Kommentar {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

function DialogSeksjon({ oppgaveId }: { oppgaveId: string }) {
  const { t } = useTranslation();
  const [nyTekst, setNyTekst] = useState("");
  const utils = trpc.useUtils();

  const { data: kommentarer } = trpc.oppgave.hentKommentarer.useQuery(
    { taskId: oppgaveId },
    { enabled: !!oppgaveId },
  );

  const leggTilMutasjon = trpc.oppgave.leggTilKommentar.useMutation({
    onSuccess: () => {
      utils.oppgave.hentKommentarer.invalidate({ taskId: oppgaveId });
      utils.oppgave.hentMedId.invalidate({ id: oppgaveId });
      setNyTekst("");
    },
  });

  const håndterSend = () => {
    if (!nyTekst.trim()) return;
    leggTilMutasjon.mutate({ taskId: oppgaveId, content: nyTekst.trim() });
  };

  const liste = (kommentarer ?? []) as Kommentar[];

  return (
    <Card className="mt-6">
      <h4 className="mb-3 text-sm font-medium text-gray-500">{t("dialog.tittel")}</h4>

      {liste.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {liste.map((k) => (
            <div key={k.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">
                  {k.user.name ?? k.user.email}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(k.createdAt).toLocaleString("nb-NO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{k.content}</p>
            </div>
          ))}
        </div>
      )}

      {liste.length === 0 && (
        <p className="mb-3 text-xs text-gray-400">{t("dialog.ingenKommentarer")}</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={nyTekst}
          onChange={(e) => setNyTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              håndterSend();
            }
          }}
          placeholder={t("dialog.skrivKommentar")}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={håndterSend}
          disabled={!nyTekst.trim() || leggTilMutasjon.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </Card>
  );
}


/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function OppgaveDetaljSide() {
  useToppbarFiltre({ byggeplass: false });
  const params = useParams<{ prosjektId: string; oppgaveId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // --- Hent brukerinfo og prosjektdata FØR skjema-hook ---

  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // H3 (videresend-rettighet): flyt-medlemskap for å begrense videresend-mottakere til egne flyter.
  const { data: mineFlyter } = trpc.medlem.hentMineFlyter.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const { data: mineTillatelserRå } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const mineTillatelser = useMemo(
    () => new Set<string>(mineTillatelserRå ?? []),
    [mineTillatelserRå],
  );

  const { data: alleFaggrupperRå } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { data: dokumentflyterRå } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const alleFaggrupper = (alleFaggrupperRå ?? []) as Array<{ id: string; name: string; color: string | null }>;
  const dokumentflyter = (dokumentflyterRå ?? []) as unknown as import("@/lib/videresend-valg").DokumentflytData[];

  // P4b: prosjektnavn til kontekst-chip-linja (utfyllingsmodus).
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  // P4b: redigerbar tittel (utfyllingsmodus).
  const [redigererTittel, setRedigererTittel] = useState(false);
  const [tittelUtkast, setTittelUtkast] = useState("");

  // Hent full oppgavedata for tidslinje/recipient/creator (cast for TS2589)
  const { data: fullOppgaveRå } = trpc.oppgave.hentMedId.useQuery(
    { id: params.oppgaveId },
    { enabled: !!params.oppgaveId },
  );

  // Flyt-kontekst — ekstrahert hook (TS2589-avlastning): de fire tunge tRPC-type-memoene
  // bor nå i useFlytKontekst der rå-outputene widenes til unknown. Identisk logikk.
  const { harBallen, minRolle, flytRettighet, flytMedlemmer, aktivPosisjon, rettighetInput } = useFlytKontekst({
    fullDokRå: fullOppgaveRå,
    dokumentflyterRå,
    minFlytInfo: minFlytInfo as MinFlytInfoUtsnitt | undefined,
    mineTillatelser,
  });

  // --- Skjema-hook med rettighetsinfo ---

  const {
    oppgave,
    erLaster,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erSynlig,
    erFeltLåst,
    valideringsfeil,
    erRedigerbar,
    lagreStatus,
  } = useOppgaveSkjema(params.oppgaveId, rettighetInput);

  const { andreRedaktorer } = usePresence(params.oppgaveId, "oppgave");

  // Oversettelse (Lag 2): on-demand felt-oversettelse for bruker med annet språk
  const oppgaveKildesprak = (oppgave as unknown as { template?: { project?: { sourceLanguage?: string } } })?.template?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    params.prosjektId,
    oppgaveKildesprak,
    (oppgave?.template?.objects ?? []) as { id: string; label: string; config: Record<string, unknown> }[],
  );

  const [statusFeil, setStatusFeil] = useState<string | null>(null);
  // Kvitterings-øyeblikket (A-3b Del 1b): momentan bekreftelse etter egen handling,
  // vist optimistisk i badgen og erstattet av sann perspektiv-tilstand når den ryddes.
  // Klient-only — ALDRI lagret tilstand. Nøklet på HANDLING (tekstNoekkel, ikke
  // nyStatus — nyStatus er ikke injektiv over handlinger, se kvitteringEtikett).
  // handlingRef fanger tekstNoekkel ved klikk, siden mutate-input-typen (Zod-schema)
  // ikke bærer den — å legge den til der ville gitt en TS excess-property-feil.
  const [kvittering, setKvittering] = useState<ReturnType<typeof kvitteringEtikett>>(null);
  const kvitteringTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handlingRef = useRef<string | undefined>(undefined);
  useEffect(() => () => clearTimeout(kvitteringTimer.current), []);

  // P6: utkast-slett var stille no-op — onSlett ble aldri sendt til
  // DokumentHandlingsmeny. Speiler sjekkliste-detaljsiden (myk slett + retur).
  const slettMutasjon = trpc.oppgave.slett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForProsjekt.invalidate();
      router.push(`/dashbord/${params.prosjektId}/oppgaver`);
    },
  });

  const endreStatusMutasjon = trpc.oppgave.endreStatus.useMutation({
    onSuccess: () => {
      setStatusFeil(null);
      const k = handlingRef.current ? kvitteringEtikett(handlingRef.current) : null;
      if (k) {
        setKvittering(k);
        clearTimeout(kvitteringTimer.current);
        kvitteringTimer.current = setTimeout(() => setKvittering(null), 2200);
      }
      utils.oppgave.hentForProsjekt.invalidate();
      utils.oppgave.hentMedId.invalidate({ id: params.oppgaveId });
    },
    // TS2589-avlastning: shallow error-type unngår instansiering av dyp tRPC-feiltype.
    onError: (error: { message?: string }) => {
      setStatusFeil(error.message ?? "Kunne ikke endre status. Prøv igjen.");
    },
  });

  // HMS-oppgaver (domain="hms") får en egen handlingsflate i stedet for den
  // generelle statusmaskinen (Ordre D). Domenet leses fra malen på full-queryen.
  const erHms =
    (fullOppgaveRå as { template?: { domain?: string } } | undefined)?.template?.domain === "hms";

  const { data: erHmsAdmin = false } = trpc.hms.erHmsAdmin.useQuery(
    { projectId: params.prosjektId },
    { enabled: erHms && !!params.prosjektId },
  );

  // Delt suksess/feil-håndtering for de fire HMS-mutasjonene.
  const hmsMutasjonOpts = {
    onSuccess: () => {
      setStatusFeil(null);
      utils.oppgave.hentForProsjekt.invalidate();
      utils.oppgave.hentMedId.invalidate({ id: params.oppgaveId });
    },
    onError: (error: { message?: string }) => {
      setStatusFeil(error.message ?? "Kunne ikke utføre HMS-handlingen. Prøv igjen.");
    },
  };

  const hmsBesvarMutasjon = trpc.oppgave.hmsBesvar.useMutation(hmsMutasjonOpts);
  const hmsLukkMutasjon = trpc.oppgave.hmsLukk.useMutation(hmsMutasjonOpts);
  const hmsGjenapneMutasjon = trpc.oppgave.hmsGjenapne.useMutation(hmsMutasjonOpts);
  const hmsTilfoyMutasjon = trpc.oppgave.hmsTilfoyInformasjon.useMutation(hmsMutasjonOpts);

  const hmsLaster =
    hmsBesvarMutasjon.isPending ||
    hmsLukkMutasjon.isPending ||
    hmsGjenapneMutasjon.isPending ||
    hmsTilfoyMutasjon.isPending;

  const utforHmsHandling = useCallback(
    (type: HmsHandlingType, tekst: string | undefined) => {
      const id = params.oppgaveId;
      if (type === "tilfoyInformasjon") {
        hmsTilfoyMutasjon.mutate({ id, kommentar: tekst ?? "" });
      } else if (type === "besvar") {
        hmsBesvarMutasjon.mutate({ id, begrunnelse: tekst ?? "" });
      } else if (type === "lukk") {
        hmsLukkMutasjon.mutate({ id, kommentar: tekst });
      } else if (type === "gjenapne") {
        hmsGjenapneMutasjon.mutate({ id, kommentar: tekst });
      }
    },
    [params.oppgaveId, hmsTilfoyMutasjon, hmsBesvarMutasjon, hmsLukkMutasjon, hmsGjenapneMutasjon],
  );


  const oppdaterMutasjon = trpc.oppgave.oppdater.useMutation({
    onSuccess: () => {
      utils.oppgave.hentMedId.invalidate({ id: params.oppgaveId });
    },
  });


  // Bygg trestruktur og flat ut i DFS-rekkefølge
  const objekter = useMemo(() => {
    const rå = (oppgave?.template?.objects ?? []) as RapportObjekt[];
    const sortert = [...rå].sort((a, b) => {
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    });

    const barnMap = new Map<string, RapportObjekt[]>();
    const rotObjekter: RapportObjekt[] = [];

    for (const obj of sortert) {
      if (obj.parentId) {
        const liste = barnMap.get(obj.parentId) ?? [];
        liste.push(obj);
        barnMap.set(obj.parentId, liste);
      } else {
        rotObjekter.push(obj);
      }
    }

    const resultat: RapportObjekt[] = [];
    function leggTilRekursivt(objekter: RapportObjekt[]) {
      for (const obj of objekter) {
        resultat.push(obj);
        const barn = barnMap.get(obj.id);
        if (barn) leggTilRekursivt(barn);
      }
    }
    leggTilRekursivt(rotObjekter);

    return resultat;
  }, [oppgave]);

  // Finn barn av repeatere
  const { repeaterBarnIder, barneObjekterMap } = useMemo(() => {
    const repeaterIder = new Set(objekter.filter((o) => o.type === "repeater").map((o) => o.id));
    const barnIder = new Set<string>();
    const barnMap = new Map<string, RapportObjekt[]>();

    for (const obj of objekter) {
      if (obj.parentId && repeaterIder.has(obj.parentId)) {
        barnIder.add(obj.id);
        const liste = barnMap.get(obj.parentId) ?? [];
        liste.push(obj);
        barnMap.set(obj.parentId, liste);
      }
    }

    return { repeaterBarnIder: barnIder, barneObjekterMap: barnMap };
  }, [objekter]);

  const hentNestingNivå = useCallback(
    (objekt: RapportObjekt, alleObjekter: RapportObjekt[]): number => {
      const parentId = objekt.parentId ?? (objekt.config.conditionParentId as string | undefined);
      if (!parentId) return 0;
      const forelder = alleObjekter.find((o) => o.id === parentId);
      if (!forelder) return 0;
      return 1 + hentNestingNivå(forelder, alleObjekter);
    },
    [],
  );

  // Oppgavenummer med prefiks
  const oppgaveNummer = useMemo(() => {
    if (oppgave?.number == null) return null;
    const nummerPad = String(oppgave.number).padStart(3, "0");
    return oppgave.template?.prefix ? `${oppgave.template.prefix}-${nummerPad}` : nummerPad;
  }, [oppgave?.number, oppgave?.template?.prefix]);

  // P2 (tom-besvarelse): speiler server-guarden fra lagret svar-data (samme delte
  // helper + input som serveren). Deaktiverer Besvar til minst ett svar-felt er utfylt.
  const besvarDeaktivertGrunn = useMemo(() => {
    const objs = (oppgave?.template?.objects ?? []) as { id: string; type: string }[];
    const data = ((oppgave as unknown as { data?: unknown })?.data ?? null) as Record<string, { verdi?: unknown; kommentar?: unknown; vedlegg?: unknown }> | null;
    return harMinstEttUtfyltFelt(objs, data) ? null : t("statushandling.laast.tomBesvarelse");
  }, [oppgave, t]);

  const leseModus = !erRedigerbar;

  if (erLaster) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!oppgave) {
    return <p className="py-12 text-center text-gray-500">{t("oppgaver.ikkeFunnet")}</p>;
  }

  // P4b: kontekst-chip-linje (utfyllingsmodus). Byggeplass er tegning-avledet på
  // oppgave (ingen byggeplassId på oppgave — audit) → display; faggruppe (utfører)
  // = velger i utkast; prosjekt/mal = display.
  const oppgaveCast = oppgave as unknown as {
    title: string;
    status: string;
    template?: { id: string; name?: string | null } | null;
    utforerFaggruppe?: { id: string; name?: string | null } | null;
    drawing?: { byggeplass?: { name?: string } | null } | null;
  };
  const erUtkast = oppgaveCast.status === "draft";

  function lagreTittel() {
    const ny = tittelUtkast.trim();
    setRedigererTittel(false);
    if (ny && ny !== oppgaveCast.title) {
      oppdaterMutasjon.mutate({ id: params.oppgaveId, title: ny });
    }
  }

  const kontekstChips: import("@/components/kontekst-chip/DokumentKontekstChipLinje").Chip[] = [
    {
      etikett: t("kontekstChip.prosjekt"),
      verdi: prosjekt?.name ?? t("kontekstChip.laster"),
      type: "display",
    },
    {
      etikett: t("kontekstChip.byggeplass"),
      verdi: oppgaveCast.drawing?.byggeplass?.name ?? t("kontekstChip.heleProsjektet"),
      type: "display",
    },
    {
      etikett: t("tabell.utforer"),
      verdi: oppgaveCast.utforerFaggruppe?.name ?? "—",
      type: "velger",
      deaktivert: !erUtkast,
      deaktivertGrunn: t("kontekstChip.faggruppeKunUtkast"),
      valgtId: oppgaveCast.utforerFaggruppe?.id ?? null,
      alternativer: alleFaggrupper.map((f) => ({ id: f.id, navn: f.name })),
      onVelg: (id) => {
        if (id) oppdaterMutasjon.mutate({ id: params.oppgaveId, utforerFaggruppeId: id });
      },
    },
    {
      etikett: t("sjekklister.mal"),
      verdi: oppgaveCast.template?.name ?? "—",
      type: "display",
    },
  ];

  return (
    <div className="max-w-3xl pb-12">
      {/* Skjerm-header: sticky ved scrolling */}
      <div className="print-skjul sticky top-0 z-10 bg-white border-b border-gray-100 -mx-6 px-4 sm:px-6 py-3 mb-3">
        {/* Rad 1: Nummer + Tittel + Dato + Status */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {oppgaveNummer && (
            <span className="text-sm font-bold text-gray-500">{oppgaveNummer}</span>
          )}
          {/* P4b: redigerbar tittel (utfyllingsmodus). */}
          {redigererTittel ? (
            <input
              autoFocus
              value={tittelUtkast}
              onChange={(e) => setTittelUtkast(e.target.value)}
              onBlur={lagreTittel}
              onKeyDown={(e) => {
                if (e.key === "Enter") lagreTittel();
                if (e.key === "Escape") setRedigererTittel(false);
              }}
              maxLength={255}
              aria-label={t("handling.rediger")}
              className="min-h-11 max-w-[60vw] rounded-md border border-sitedoc-primary px-2 py-0.5 text-base font-bold focus:outline-none sm:max-w-none sm:text-lg"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTittelUtkast(oppgave.title);
                setRedigererTittel(true);
              }}
              title={t("handling.rediger")}
              className="group flex min-h-11 items-center gap-1.5 text-left"
            >
              <span className="truncate text-base font-bold max-w-[55vw] sm:max-w-none sm:text-lg">
                {oppgave.title}
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-500" />
            </button>
          )}
          <LagreIndikator status={lagreStatus} />
          {andreRedaktorer.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
              <Pencil className="h-3 w-3 animate-pulse" />
              <span className="hidden sm:inline">{andreRedaktorer.map((u) => u.navn).join(", ")} {t("presence.redigerer")}</span>
              <span className="sm:hidden">{andreRedaktorer.length}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(fullOppgaveRå as { createdAt?: string })?.createdAt && (
              <span className="hidden sm:inline text-xs text-gray-400">
                {new Date((fullOppgaveRå as { createdAt: string }).createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            )}
            <StatusBadge
              status={oppgave.status}
              lestAvMottakerVed={(fullOppgaveRå as { lestAvMottakerVed?: string | null })?.lestAvMottakerVed}
              perspektiv={kvittering ?? perspektivEtikett(oppgave.status, { rolle: minRolle ?? null, harBallen, erAdmin: minFlytInfo?.erAdmin ?? false }, "oppgave")}
            />
            {/* Ball-holder-chip (Del 1c): person foran faggruppe, synlig når ballen er i spill. */}
            {(() => {
              if (!["sent", "received", "in_progress", "responded", "rejected"].includes(oppgave.status)) return null;
              const o = fullOppgaveRå as {
                recipientGroup?: { id: string; name: string } | null;
                recipientUserId?: string | null;
                recipientGroupId?: string | null;
              } | undefined;
              const navn =
                finnMottakerNavn(flytMedlemmer, o?.recipientUserId, o?.recipientGroupId) ?? o?.recipientGroup?.name;
              if (!navn) return null;
              return (
                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                  {t("tabell.venterPaa")}: {navn}
                </span>
              );
            })()}
          </div>
        </div>

        {/* P4b Rad 1b: kontekst-chip-linje (utfyllingsmodus). */}
        <div className="print-skjul mt-2">
          <DokumentKontekstChipLinje chips={kontekstChips} />
        </div>

        {/* Rad 2: FlytIndikator (full bredde på mobil).
            F1b: skjul for HMS — HMS har egen HmsHandlingsflate; flytlinja ville vært
            redundant + vist "?" for null-medlem-oppretterboksen til Fase 2 navngir den. */}
        {!erHms && flytMedlemmer.length > 0 && (
          <div className="mt-2">
            {/* Desktop: full flyt */}
            <div className="hidden sm:block">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
                visUtveier
              />
            </div>
            {/* Mobil: kompakt flyt med tap-for-expand */}
            <div className="sm:hidden">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
                kompakt
                visUtveier
              />
            </div>
          </div>
        )}

        {/* Feilmelding fra endreStatus-mutasjon (HMS viser sin egen i handlingsflaten) */}
        {statusFeil && !erHms && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {statusFeil}
          </div>
        )}

        {/* Rad 3: Handlingsknapper (full bredde på mobil) */}
        <div className="mt-2 flex items-center gap-2">
          {erHms ? (
            <HmsHandlingsflate
              status={oppgave.status}
              erOppretter={
                !!(fullOppgaveRå as { bestillerUserId?: string })?.bestillerUserId &&
                (fullOppgaveRå as { bestillerUserId?: string }).bestillerUserId === minFlytInfo?.userId
              }
              erHmsAdmin={erHmsAdmin}
              erLaster={hmsLaster}
              feilmelding={statusFeil}
              onUtfor={utforHmsHandling}
            />
          ) : (
          <DokumentHandlingsmeny
            status={oppgave.status}
            aktivPosisjon={aktivPosisjon}
            erLaster={endreStatusMutasjon.isPending}
            onEndreStatus={(nyStatus, handlingNoekkel, kommentar, mottaker) => {
              handlingRef.current = handlingNoekkel;
              endreStatusMutasjon.mutate({
                id: params.oppgaveId,
                nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
                senderId: undefined,
                kommentar,
                recipientUserId: mottaker?.userId,
                recipientGroupId: mottaker?.groupId,
                dokumentflytId: mottaker?.dokumentflytId,
              });
            }}
            alleFaggrupper={alleFaggrupper}
            dokumentflyter={dokumentflyter}
            templateId={(oppgave as unknown as { templateId?: string }).templateId ?? oppgave.template?.id}
            standardFaggruppeId={oppgave.utforerFaggruppe?.id}
            minRolle={minRolle}
            adminNiva={minFlytInfo?.adminNiva ?? null}
            flytMedlemmer={flytMedlemmer}
            mineFlytIder={mineFlyter}
            recipientUserId={(fullOppgaveRå as { recipientUserId?: string | null })?.recipientUserId}
            recipientGroupId={(fullOppgaveRå as { recipientGroupId?: string | null })?.recipientGroupId}
            bestillerUserId={(fullOppgaveRå as { bestillerUserId?: string })?.bestillerUserId}
            lestAvMottakerVed={(fullOppgaveRå as { lestAvMottakerVed?: string | null })?.lestAvMottakerVed}
            besvarDeaktivertGrunn={besvarDeaktivertGrunn}
            onSlett={() => slettMutasjon.mutate({ id: params.oppgaveId })}
          />
          )}
          <button
            onClick={() => window.open(`/utskrift/oppgave/${params.oppgaveId}?print=true`, "_blank")}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            title={t("handling.skrivUtEnkel")}
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>

        {/* Beskrivelse (kun hvis finnes) */}
        {oppgave.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2 sm:line-clamp-none">{oppgave.description}</p>
        )}

        {/* Lokasjon */}
        <div className="mt-2 max-w-md print-skjul">
          <LokasjonVelger
            prosjektId={params.prosjektId}
            tegningId={(oppgave as unknown as { drawingId?: string | null }).drawingId}
            tegningNavn={(oppgave as unknown as { drawing?: { name?: string } | null }).drawing?.name}
            bygningNavn={(oppgave as unknown as { drawing?: { byggeplass?: { name?: string } | null } | null }).drawing?.byggeplass?.name}
            positionX={(oppgave as unknown as { positionX?: number | null }).positionX}
            positionY={(oppgave as unknown as { positionY?: number | null }).positionY}
            visPosisjon
            onLagre={(data) => {
              oppdaterMutasjon.mutate({
                id: params.oppgaveId,
                drawingId: data.drawingId,
                positionX: data.positionX ?? null,
                positionY: data.positionY ?? null,
              });
            }}
            leseModus={["closed", "approved"].includes(oppgave.status)}
          />
        </div>
      </div>

      {/* Rapportobjekter */}
      {objekter.length > 0 && (
        <UtfyllingSeksjoner
          objekter={objekter}
          render={(objekt) => {
            if (repeaterBarnIder.has(objekt.id)) return null;
            if (!erSynlig(objekt)) return null;
            if (!leseModus && SKJULT_I_UTFYLLING.has(objekt.type)) return null;

            const erDisplay = DISPLAY_TYPER.has(objekt.type);
            const nestingNivå = hentNestingNivå(objekt, objekter);
            const feltVerdi = hentFeltVerdi(objekt.id);
            // Append-only: verdi-feltet er låst, men kommentar/vedlegg er redigerbare
            const feltLåst = erFeltLåst(objekt.id);
            const verdiLeseModus = leseModus || feltLåst;

            if (erDisplay) {
              const marginKlasse = nestingNivå > 0
                ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
                : "";
              return (
                <div key={objekt.id} className={marginKlasse}>
                  <RapportObjektRenderer
                    objekt={objekt}
                    verdi={feltVerdi.verdi}
                    onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                    leseModus={verdiLeseModus}
                    prosjektId={params.prosjektId}
                  />
                </div>
              );
            }

            return (
              <div key={objekt.id}>
                <FeltWrapper
                  objekt={objekt}
                  kommentar={feltVerdi.kommentar}
                  vedlegg={feltVerdi.vedlegg}
                  onEndreKommentar={(k) => settKommentar(objekt.id, k)}
                  onLeggTilVedlegg={(v) => leggTilVedlegg(objekt.id, v)}
                  onFjernVedlegg={(id) => fjernVedlegg(objekt.id, id)}
                  leseModus={leseModus}
                  nestingNivå={nestingNivå}
                  valideringsfeil={valideringsfeil[objekt.id]}
                  prosjektId={params.prosjektId}
                  oversettelser={oversettelser}
                  oversettelseLaster={oversettelseLaster}
                  onOversett={() => oversettFelt(objekt as { id: string; label: string; config: Record<string, unknown> })}
                  visOversettKnapp={visOversettKnapp}
                  originalData={(feltVerdi as unknown as { original?: { spraak: string; verdi?: string; kommentar?: string } }).original}
                >
                  <RapportObjektRenderer
                    objekt={objekt}
                    verdi={feltVerdi.verdi}
                    onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                    leseModus={verdiLeseModus}
                    prosjektId={params.prosjektId}
                    barneObjekter={barneObjekterMap.get(objekt.id)}
                  />
                </FeltWrapper>
              </div>
            );
          }}
        />
      )}

      {/* Dialog */}
      <DialogSeksjon oppgaveId={params.oppgaveId} />

      {/* Tidslinje */}
      {fullOppgaveRå && (
        <DokumentTidslinje
          overforinger={((fullOppgaveRå as { transfers?: unknown[] }).transfers ?? []) as Array<{
            id: string; fromStatus: string; toStatus: string; comment: string | null; createdAt: string;
            sender?: { id: string; name: string | null } | null;
            recipientUser?: { id: string; name: string | null } | null;
            recipientGroup?: { id: string; name: string | null } | null;
          }>}
          opprettetAv={(fullOppgaveRå as { bestiller?: { name?: string | null } }).bestiller?.name ?? null}
          opprettetDato={(fullOppgaveRå as { createdAt?: string }).createdAt ?? null}
        />
      )}

    </div>
  );
}
