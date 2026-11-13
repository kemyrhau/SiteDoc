import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetUtleggLocal,
  equipmentLocal,
  byggeplassLocal,
} from "../../../../src/db/schema";
import { useTimerSync } from "../../../../src/providers/TimerSyncProvider";
import { useNettverk } from "../../../../src/providers/NettverkProvider";
import { trpc } from "../../../../src/lib/trpc";
import { TimerStatusMerkelapp } from "../../../../src/components/TimerStatusMerkelapp";
import { TilleggSeksjon } from "../../../../src/components/timer-detalj/TilleggSeksjon";
import { UtleggSeksjon } from "../../../../src/components/timer-detalj/UtleggSeksjon";
import { ProsjektkortKontekst } from "../../../../src/components/timer-detalj/prosjektkortKontekst";
import { HjelpIkon } from "../../../../src/components/HjelpIkon";
import { BekreftFjernMatpauseModal } from "../../../../src/components/timer-detalj/BekreftFjernMatpauseModal";
import type { VisVarelinje } from "../../../../src/components/timer-detalj/VareforbrukLesListe";
import { ProsjektkortDagsoversikt } from "../../../../src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt";
import { finnProsjektLokalt } from "../../../../src/services/prosjektKatalog";
import { prosjektVisningsnavn } from "../../../../src/utils/prosjektNavn";
import { hentDagsnormLokalt } from "../../../../src/services/arbeidstidSvarKatalog";
import { finnUnderprosjektLokalt, hentReiseLonnsartId } from "../../../../src/services/timerKatalog";
import { harMaskinforerbevisLokalt } from "../../../../src/services/maskinKatalog";
import { hentVarelagerProsjekterLokalt } from "../../../../src/services/vareKatalog";
import {
  hentLokaleVarelinjer,
  type LokalVarelinje,
} from "../../../../src/services/vareforbrukSync";
import {
  flyttMatpauseVedAvhuking,
  settMatpauseBaerer,
  fjernMatpause,
} from "../../../../src/services/matpause";
import { useMiniToast, MiniToast } from "../../../../src/components/MiniToast";
import { useReLesVedSynk } from "../../../../src/hooks/useReLesVedSynk";
import { formatNorskDato, isoTidspunktTilHHMM } from "../../../../src/utils/dato";
import {
  effektivByggeplass,
  formatKortTall,
  fraRuteParam,
  kortNokkel,
  kortValgFor,
  lagretByggeplassForKort,
  raderPaaKort,
  type KortValg,
  type SedelKortKontekst,
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
  tilRuteParam,
  varerForProsjekt,
} from "../../../../src/lib/prosjektkortMobil";
import { KortValgModal } from "../../../../src/components/timer-detalj/prosjektkort/KortValgModal";
import { BekreftSlettModal } from "../../../../src/components/timer-detalj/prosjektkort/BekreftSlettModal";
import {
  flyttKort,
  kortFinnesFraFor,
  kortInnhold,
  kortUtfallTekst,
  slettKort,
  vareFinnesPaaServer,
  type KortDag,
  type KortUtfall,
} from "../../../../src/components/timer-detalj/prosjektkort/kortRadFlytt";
import { KortHode } from "../../../../src/components/timer-detalj/prosjektkort/ProsjektkortSamleside";
import type {
  Sedel,
  TimerRad,
  MaskinRad,
  TilleggRad,
  UtleggRad,
} from "../../../../src/types/timer-detalj";

/**
 * Prosjektkort L2 (spec § 4.3): ett prosjekts del av dagen. Samme DailySheet
 * som samlesiden (modell A) — radene filtreres på prosjektet. Prosjektet er
 * låst i rad-modalen via ProsjektkortKontekst; byggeplass kan fortsatt velges.
 * Et tomt kort lagres ikke: det finnes først når første rad er lagt til.
 */
export default function ProsjektkortSkjerm() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; projectId: string; bp?: string; up?: string }>();
  const sheetId = params.id ?? "";
  const projectId = params.projectId ?? "";
  // ORDRE 36b: kortet = (prosjekt, byggeplass, underprosjekt). Mangler `bp`
  // (gammel rute) velges prosjektets første kort.
  const bpParam = fraRuteParam(params.bp);
  const upParam = fraRuteParam(params.up) ?? null;
  const { triggerSync, pushSedel, oppdaterTellere, sistSynkronisert } = useTimerSync();
  const { erPaaNettet } = useNettverk();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [utleggRader, setUtleggRader] = useState<UtleggRad[]>([]);
  const [harEquipmentCache, setHarEquipmentCache] = useState(false);
  const [harMaskinforerbevis, setHarMaskinforerbevis] = useState(true);
  const { melding: pauseToast, vis: visPauseToast } = useMiniToast();
  const [bekreftFjernRadId, setBekreftFjernRadId] = useState<string | null>(null);
  const [lokaleVarer, setLokaleVarer] = useState<LokalVarelinje[]>([]);
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);
  // ORDRE 36c-kort: «Endre kort» (KortValgModal, hele kortet) og «Slett kort».
  const [visEndre, setVisEndre] = useState(false);
  const [visSlett, setVisSlett] = useState(false);
  const [kortFeil, setKortFeil] = useState<string | null>(null);
  const [kortArbeider, setKortArbeider] = useState(false);
  const oppdaterVare = trpc.vareforbruk.oppdater.useMutation();
  const slettVare = trpc.vareforbruk.slett.useMutation();

  // Samme lesing som timer/[id] — alle dagens rader (overlapp og matpause
  // gjelder hele dagen); filtrering pr. prosjekt skjer ved visning.
  const lesData = useCallback(() => {
    const db = hentDatabase();
    if (!db) return;
    const sedelRad = db
      .select()
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, sheetId))
      .all()[0];
    if (!sedelRad) {
      setSedel(null);
      return;
    }
    setSedel(sedelRad);
    setTimerRader(
      db.select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).all(),
    );
    setMaskinRader(
      db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
    );
    setTilleggRader(
      db.select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.dagsseddelId, sheetId)).all(),
    );
    setUtleggRader(
      db.select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.dagsseddelId, sheetId)).all(),
    );
    const equipmentCount = db
      .select({ id: equipmentLocal.id })
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, sedelRad.organizationId))
      .all().length;
    setHarEquipmentCache(equipmentCount > 0);
    setLokaleVarer(hentLokaleVarelinjer(sheetId, projectId));
  }, [sheetId, projectId]);

  useFocusEffect(
    useCallback(() => {
      lesData();
    }, [lesData]),
  );
  useReLesVedSynk(sistSynkronisert, lesData);

  useEffect(() => {
    const orgId = sedel?.organizationId;
    if (!orgId) return;
    let aktiv = true;
    void harMaskinforerbevisLokalt(orgId).then((gyldig) => {
      if (aktiv) setHarMaskinforerbevis(gyldig);
    });
    return () => {
      aktiv = false;
    };
  }, [sedel?.organizationId]);

  useEffect(() => {
    const orgId = sedel?.organizationId;
    if (!orgId) return;
    let aktiv = true;
    void hentVarelagerProsjekterLokalt(orgId).then((ider) => {
      if (aktiv) setVarelagerProsjekter(ider);
    });
    return () => {
      aktiv = false;
    };
  }, [sedel?.organizationId, sistSynkronisert]);

  const erRedigerbar = sedel?.status === "draft" || sedel?.status === "returned";

  const markerEndretOgLes = useCallback(() => {
    const db = hentDatabase();
    if (!db || !sedel) return;
    db.update(dagsseddelLocal)
      .set({ sistEndretLokalt: Date.now(), syncStatus: "pending" })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    oppdaterTellere();
    void triggerSync();
    lesData();
  }, [sedel, sheetId, oppdaterTellere, triggerSync, lesData]);

  // F5-matpausen er dag-nivå (kryss-kort), som på samlesiden. ORDRE 36b:
  // avhukingen vises i rad-modalen (RadHandlinger), ikke på rad-kortet.
  const handterPauseToggle = useCallback(
    (radId: string, vilHa: boolean) => {
      if (!sedel) return;
      if (vilHa) {
        settMatpauseBaerer(sheetId, radId, sedel.organizationId, sedel.dato);
        markerEndretOgLes();
        return;
      }
      const res = flyttMatpauseVedAvhuking(sheetId, radId, sedel.organizationId, sedel.dato);
      if (res.utfall === "flyttet") {
        markerEndretOgLes();
        visPauseToast(t("timer.matpause.flyttet", { tidsrom: res.tilTidsrom }));
      } else if (res.utfall === "ingenKvalifisert") {
        setBekreftFjernRadId(radId);
      }
    },
    [sedel, sheetId, markerEndretOgLes, visPauseToast, t],
  );

  const bekreftFjernMatpause = useCallback(() => {
    if (!sedel) return;
    fjernMatpause(sheetId, sedel.organizationId, sedel.dato);
    setBekreftFjernRadId(null);
    markerEndretOgLes();
  }, [sedel, sheetId, markerEndretOgLes]);

  const sedelKontekst = useMemo<SedelKortKontekst | null>(() => {
    if (!sedel) return null;
    const db = hentDatabase();
    const bp =
      db && sedel.byggeplassId
        ? db
            .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
            .from(byggeplassLocal)
            .where(eq(byggeplassLocal.id, sedel.byggeplassId))
            .all()[0]
        : undefined;
    return {
      projectId: sedel.projectId,
      byggeplass: bp ? { id: bp.id, projectId: bp.projectId } : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedel?.projectId, sedel?.byggeplassId]);

  const ecoNavn = useCallback((ecoId: string): string => {
    const e = finnUnderprosjektLokalt(ecoId);
    return e ? `${e.proAdmId} — ${e.kortNavn}` : ecoId;
  }, []);

  const orgId = sedel?.organizationId;
  const reiseLonnsartId = useMemo(
    () => (orgId ? hentReiseLonnsartId(orgId) : null),
    [orgId],
  );
  const vareQuery = trpc.vareforbruk.hentMineForDato.useQuery(
    { organizationId: sedel?.organizationId ?? "", dato: sedel?.dato ?? "" },
    { enabled: erPaaNettet && !!sedel },
  );
  // Server-linjer + lokale fra kortet (L3). Synket lokal linje har samme id
  // som server-raden → telles én gang; offline vises de lokale alene.
  const varer = useMemo(
    () =>
      varerForProsjekt<VisVarelinje>(tilKortVarer(vareQuery.data ?? []), lokaleVarer, projectId),
    [vareQuery.data, lokaleVarer, projectId],
  );

  // V21 (Kenneth 2026-11-12): dagsnormen til rad-modalens overtidsforslag —
  // samme svar-cache som samlesida (`useProsjektkortSedel`), regner aldri.
  const normTimer = useMemo(
    () => (sedel ? hentDagsnormLokalt(sedel.organizationId, sedel.dato)?.dagsnorm ?? null : null),
    [sedel],
  );

  const prosjektNavn = useMemo(() => {
    return prosjektVisningsnavn(finnProsjektLokalt(projectId), t("timer.detalj.ukjentProsjekt"));
  }, [projectId, t]);

  const byggeplassNavn = useCallback((byggeplassId: string): string | null => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ navn: byggeplassLocal.navn })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, byggeplassId))
        .all()[0]?.navn ?? null
    );
  }, []);

  // Funn 3: byggeplassens prosjekt til kortoverskriften (arv på tvers av prosjekt teller ikke).
  const byggeplassProsjekt = useCallback((byggeplassId: string): string | null => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ projectId: byggeplassLocal.projectId })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, byggeplassId))
        .all()[0]?.projectId ?? null
    );
  }, []);

  if (!sedel) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.prosjektkort.tittel")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t("timer.ikkeFunnet")}</Text>
        </View>
      </View>
    );
  }

  const kontekst = sedelKontekst ?? { projectId: sedel.projectId, byggeplass: null };
  const iProsjektet = (r: { projectId: string | null }) =>
    (r.projectId ?? sedel.projectId) === projectId;
  const forste = [...timerRader, ...maskinRader].find(iProsjektet);
  const valg: KortValg =
    bpParam === undefined
      ? forste
        ? kortValgFor(forste, kontekst)
        : { projectId, byggeplassId: effektivByggeplass(projectId, null, kontekst), ecoId: null }
      : { projectId, byggeplassId: bpParam, ecoId: upParam };
  const kTimer = raderPaaKort(timerRader, kontekst, valg);
  const kMaskin = raderPaaKort(maskinRader, kontekst, valg);
  const kVarer = raderPaaKort(varer, kontekst, valg);
  // Spec tillegg-utlegg-prosjektkort § 3: tillegg og utlegg hører til kortet.
  const kTillegg = raderPaaKort(tilleggRader, kontekst, valg);
  const kUtlegg = raderPaaKort(utleggRader, kontekst, valg);
  const tomt = kTimer.length + kMaskin.length + kVarer.length + kTillegg.length + kUtlegg.length === 0;

  // ORDRE 36c-kort: kortets innhold (arbeid uten reise, maskin + koblet, varer,
  // tillegg og utlegg — B4: Endre/Slett kort tar dem med).
  const innhold = kortInnhold({
    timerRader,
    maskinRader,
    varer,
    tilleggRader,
    utleggRader,
    sedel: kontekst,
    kort: valg,
    reiseLonnsartId,
  });
  const dag: KortDag = {
    sheetId,
    organizationId: sedel.organizationId,
    status: sedel.status,
    pauseMin: sedel.pauseMin ?? 0,
    sedel: kontekst,
    timerRader,
    maskinRader,
  };
  const sperretOffline = !erPaaNettet && innhold.varer.some(vareFinnesPaaServer);
  const kortNavn = (k: typeof valg) =>
    [
      prosjektVisningsnavn(finnProsjektLokalt(k.projectId), t("timer.detalj.ukjentProsjekt")),
      k.byggeplassId ? byggeplassNavn(k.byggeplassId) ?? k.byggeplassId : t("timer.kortValg.utenByggeplass"),
      k.ecoId ? ecoNavn(k.ecoId) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  // Siste kort: ingen andre arbeid-, maskin-, vare-, tillegg- eller utleggrader på dagen.
  const iKortet = new Set(
    [
      ...innhold.timer,
      ...innhold.maskin,
      ...innhold.varer,
      ...(innhold.tillegg ?? []),
      ...(innhold.utlegg ?? []),
    ].map((r) => r.id),
  );
  const sisteKort =
    timerRader.every((r) => iKortet.has(r.id) || r.erReise === true || r.lonnsartId === reiseLonnsartId) &&
    maskinRader.every((m) => iKortet.has(m.id)) &&
    tilleggRader.every((r) => iKortet.has(r.id)) &&
    utleggRader.every((r) => iKortet.has(r.id)) &&
    [...(vareQuery.data ?? []), ...lokaleVarer].every((v) => iKortet.has(v.id));
  const visUtfall = (u: KortUtfall, handling: "slett" | "flytt"): boolean => {
    if (u.utfall === "ok") return true;
    const tekst = kortUtfallTekst(u, handling);
    const grunn = u.utfall === "delvis" && u.melding ? `\n${u.melding}` : "";
    setKortFeil(tekst ? t(tekst, { defaultValue: tekst }) + grunn : null);
    return false;
  };
  const utforEndre = async (til: typeof valg) => {
    if (kortArbeider) return;
    setKortArbeider(true);
    const u = await flyttKort(hentDatabase()!, dag, innhold, valg, til, {
      erPaaNettet,
      pushSedel: () => pushSedel(sheetId),
      flyttVare: async (id, maal) => {
        await oppdaterVare.mutateAsync({
          id,
          projectId: maal.projectId,
          byggeplassId: maal.byggeplassId,
          externalCostObjectId: maal.ecoId,
        });
      },
    });
    setKortArbeider(false);
    if (u.utfall === "delvis") {
      // 36c-kort-3: timer er flyttet — les på nytt; modalen står med teksten,
      // og «Flytt» igjen flytter varene som ble igjen på dette kortet.
      lesData();
      void vareQuery.refetch();
    }
    if (!visUtfall(u, "flytt")) return;
    setVisEndre(false);
    markerEndretOgLes();
    void vareQuery.refetch();
    router.replace(
      `/timer/${sheetId}/kort/${til.projectId}?bp=${tilRuteParam(til.byggeplassId)}&up=${tilRuteParam(til.ecoId)}`,
    );
  };
  const utforSlett = async () => {
    if (kortArbeider) return;
    setKortArbeider(true);
    const u = await slettKort(hentDatabase()!, dag, innhold, {
      erPaaNettet,
      slettVare: async (id) => {
        await slettVare.mutateAsync({ id });
      },
    });
    setKortArbeider(false);
    setVisSlett(false);
    if (!visUtfall(u, "slett")) return;
    markerEndretOgLes();
    void vareQuery.refetch();
    router.back();
  };
  const slettTekst = [
    t("timer.kort.slettTekst", {
      timer: formatKortTall(innhold.timer.reduce((a, r) => a + r.timer, 0)),
      kort: kortNavn(valg),
      dato: formatNorskDato(sedel.dato),
    }),
    sedel.status === "returned" ? t("timer.kort.slettReturnert") : t("timer.kort.slettUtkast"),
    sisteKort ? t("timer.kort.slettSiste") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
          {formatNorskDato(sedel.dato)} · {t("timer.prosjektkort.tittel")}
        </Text>
        <TimerStatusMerkelapp status={sedel.status} syncStatus={sedel.syncStatus} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-24">
        <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <KortHode
            projectId={projectId}
            navn={valg.ecoId ? `${prosjektNavn} · ${ecoNavn(valg.ecoId)}` : prosjektNavn}
            timer={tilKortTimerRader(kTimer, sedel.projectId, reiseLonnsartId)}
            maskin={tilKortMaskinRader(kMaskin, sedel.projectId)}
            varer={kVarer}
            utlegg={kUtlegg.length}
            tillegg={kTillegg.length}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            byggeplassNavn={byggeplassNavn}
            byggeplassProsjekt={byggeplassProsjekt}
          />
        </View>

        {/* T.11: soft-varsel når arbeider mangler gyldig maskinførerbevis
            (som maskinseksjonen viste det: kun når maskin er ført). */}
        {harEquipmentCache && !harMaskinforerbevis && kMaskin.length > 0 && (
          <View className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={14} color="#b45309" />
              <Text className="flex-1 text-xs text-amber-800">
                {t("timer.maskinforerbevis.arbeider")}
              </Text>
            </View>
          </View>
        )}

        {tomt && erRedigerbar && (
          <Text className="mx-4 mt-3 text-sm text-gray-500">
            {t("timer.prosjektkort.tomtKort")}
          </Text>
        )}

        {/* ORDRE 36b: kortet er dagsoversikten for ett prosjekt — linjene
            åpner de delte rad-modalene, skriving via radLagring. */}
        <ProsjektkortDagsoversikt
          enkeltProsjekt
          sheetId={sheetId}
          sedel={sedel}
          kort={[valg]}
          sedelKontekst={kontekst}
          ecoNavn={ecoNavn}
          timerRader={timerRader}
          maskinRader={maskinRader}
          varer={varer}
          reiseLonnsartId={reiseLonnsartId}
          harEquipmentCache={harEquipmentCache}
          varelagerProsjekter={varelagerProsjekter}
          normTimer={normTimer}
          ramme={{
            fra: isoTidspunktTilHHMM(sedel.startAt),
            til: isoTidspunktTilHHMM(sedel.endAt),
            pauseMin: sedel.pauseMin ?? 0,
          }}
          rammeByggeplassNavn={null}
          prosjektNavn={() => prosjektNavn}
          byggeplassNavn={byggeplassNavn}
          redigerbar={erRedigerbar}
          onPauseToggle={handterPauseToggle}
          onEndret={markerEndretOgLes}
          onVarerLagret={() => {
            lesData();
            void triggerSync();
          }}
        />

        {/* Spec tillegg-utlegg-prosjektkort § 3/§ 5: tillegg og utlegg på kortet.
            Kontekst-låsen viser kortets byggeplass/underprosjekt låst i modalen;
            nye rader lagres med kortets felt (null = arv fra sedelen). */}
        <ProsjektkortKontekst.Provider value={{ byggeplassId: valg.byggeplassId, ecoId: valg.ecoId }}>
          <TilleggSeksjon
            sheetId={sheetId}
            organizationId={sedel.organizationId}
            projectId={projectId}
            rader={kTillegg}
            redigerbar={erRedigerbar}
            onEndret={markerEndretOgLes}
            hjelpIkon={<HjelpIkon tittel={t("hjelp.tillegg.tittel")} tekst={t("hjelp.tillegg.tekst")} />}
            kortFelt={{ byggeplassId: lagretByggeplassForKort(valg, kontekst), externalCostObjectId: valg.ecoId }}
          />
          <UtleggSeksjon
            sheetId={sheetId}
            organizationId={sedel.organizationId}
            projectId={projectId}
            rader={kUtlegg}
            redigerbar={erRedigerbar}
            onEndret={markerEndretOgLes}
            hjelpIkon={<HjelpIkon tittel={t("hjelp.utlegg.tittel")} tekst={t("hjelp.utlegg.tekst")} />}
            kortFelt={{ byggeplassId: lagretByggeplassForKort(valg, kontekst), externalCostObjectId: valg.ecoId }}
          />
        </ProsjektkortKontekst.Provider>

        {/* ORDRE 36c-kort: hele kortet — kun når sedelen er redigerbar. */}
        {erRedigerbar && !tomt && (
          <View className="mx-4 mt-6">
            <View className="flex-row gap-3">
              <Pressable
                disabled={sperretOffline || kortArbeider}
                accessibilityState={{ disabled: sperretOffline || kortArbeider }}
                onPress={() => {
                  setKortFeil(null);
                  setVisEndre(true);
                }}
                className="min-h-[44px] flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white active:bg-gray-50"
              >
                <Text className={`text-base ${sperretOffline ? "text-gray-400" : "text-gray-700"}`}>
                  {t("timer.kort.endre")}
                </Text>
              </Pressable>
              <Pressable
                disabled={sperretOffline || kortArbeider}
                accessibilityState={{ disabled: sperretOffline || kortArbeider }}
                onPress={() => {
                  setKortFeil(null);
                  setVisSlett(true);
                }}
                className="min-h-[44px] flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white active:bg-gray-50"
              >
                <Text className={`text-base ${sperretOffline ? "text-gray-400" : "text-red-600"}`}>
                  {t("timer.kort.slett")}
                </Text>
              </Pressable>
            </View>
            {sperretOffline && (
              <Text className="mt-2 text-sm text-amber-700">
                {t("timer.kort.offlineFlytt")} {t("timer.kort.offlineSlett")}
              </Text>
            )}
            {kortFeil && !visEndre && <Text className="mt-2 text-sm text-amber-700">{kortFeil}</Text>}
          </View>
        )}
      </ScrollView>

      {visEndre && (
        <KortValgModal
          organizationId={sedel.organizationId}
          modus={{ type: "flytt", fra: valg, heleKortet: true }}
          sedel={kontekst}
          prosjektNavn={(id) => prosjektVisningsnavn(finnProsjektLokalt(id), t("timer.detalj.ukjentProsjekt"))}
          feil={kortFeil}
          merknad={(til) =>
            kortNokkel(til) !== kortNokkel(valg) &&
            kortFinnesFraFor([...timerRader.filter((r) => !iKortet.has(r.id)), ...maskinRader.filter((m) => !iKortet.has(m.id))], kontekst, til)
              ? t("timer.kort.sammenslaa", { kort: kortNavn(til) })
              : null
          }
          onVelg={(til) => void utforEndre(til)}
          onLukk={() => setVisEndre(false)}
        />
      )}

      <BekreftSlettModal
        synlig={visSlett}
        tittel={t("timer.kort.slettTittel")}
        tekst={slettTekst}
        bekreftTekst={t("timer.kort.slett")}
        onAvbryt={() => setVisSlett(false)}
        onBekreft={() => void utforSlett()}
      />

      <BekreftFjernMatpauseModal
        synlig={bekreftFjernRadId !== null}
        onAvbryt={() => setBekreftFjernRadId(null)}
        onBekreft={bekreftFjernMatpause}
      />

      <MiniToast melding={pauseToast} />
    </View>
  );
}
