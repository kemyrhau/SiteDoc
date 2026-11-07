import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Car, Minus, Plus, Trash2, Undo2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import {
  arbeidsdagLocal,
  aktivitetLocal,
  dagsseddelLocal,
} from "../../src/db/schema";
import { useAuth } from "../../src/providers/AuthProvider";
import { useFirma, hentLagretAnsattStatus } from "../../src/kontekst/FirmaKontekst";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { tilHHMM } from "../../src/hooks/useArbeidsdag";
import { hentProsjekterLokalt } from "../../src/services/prosjektKatalog";
import { hentByggeplasserForProsjektLokalt } from "../../src/services/byggeplassKatalog";
import { FraTilTidFelt } from "../../src/components/timer-detalj/FraTilTidFelt";
import { ModalFlate } from "../../src/components/ModalFlate";
import { useModalInnsetter } from "../../src/components/ModalInnsetter";
import {
  forberedBekreftDag,
  bekreftDag,
  avsluttDagUtenSedel,
  erTomtForslag,
  erAlleDatoerSendt,
} from "../../src/utils/bekreftDag";
import {
  vaktGrunnlag,
  entydigByggeplass,
  tilleggTilstand,
  rensTillegg,
  type BekreftDagTillegg,
} from "../../src/utils/bekreftDagTillegg";
import { BekreftDagTilleggSeksjon } from "../../src/components/timer-detalj/BekreftDagTilleggSeksjon";
import { stegOvertidFra } from "../../src/utils/dagsforslag";
import type {
  DagsforslagRetting,
  DagsforslagRettingDato,
  DagsforslagDag,
  DagsforslagRad,
} from "../../src/utils/dagsforslag";

/**
 * L3-A «Bekreft dag» (spec § 3 / § 10, helhetsplan § 3 G1, Kenneth 2026-11-06).
 *
 * GPS gir FORSLAG til sted, prosjekt og reise. Forslaget blir lønnsgrunnlag
 * først når arbeideren bekrefter her. Arbeider-valget i skjermen er autoritativt.
 *
 * Invariant: ingenting skrives før [Bekreft og lagre] / [Avslutt dag]. Forlater
 * arbeideren skjermen (Ikke nå, tilbake, drept app) står dagen `paagaar`, og
 * «Slutt dag» åpner skjermen på nytt med fersk slutt-GPS. Slutt-posisjonen
 * kommer som ruteparametre fra kortet (transient, ikke lagret).
 */

type Valgark = "prosjekt" | "byggeplass" | "aktivitet" | null;

function tilTall(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatTimer(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

const PAUSE_STEG = 15;
const PAUSE_MAKS = 120;

export default function BekreftDagSkjerm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    arbeidsdagId: string;
    sluttIso: string;
    endLat?: string;
    endLng?: string;
    sisteSegmentKilde?: string;
  }>();
  const { bruker } = useAuth();
  const { valgtFirmaId, valgtFirma, erAnsattIValgtFirma } = useFirma();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const orgId = valgtFirmaId ?? "";
  const sluttIso = params.sluttIso;
  const endLat = tilTall(params.endLat);
  const endLng = tilTall(params.endLng);
  const sisteSegmentKilde: "bruker" | "system" =
    params.sisteSegmentKilde === "system" ? "system" : "bruker";

  const [retting, setRetting] = useState<DagsforslagRetting>({});
  // A2: byggeplassvalget kjører lese-fasen på nytt (kun select).
  const [valgtByggeplassId, setValgtByggeplassId] = useState<
    string | null | undefined
  >(undefined);
  const [erAnsatt, setErAnsatt] = useState<boolean | null | undefined>(undefined);
  const [valgark, setValgark] = useState<Valgark>(null);
  const [lagrer, setLagrer] = useState(false);
  // L3-D: maskin og varer holdes i minnet til Bekreft (spec § 3.5).
  const [tillegg, setTillegg] = useState<BekreftDagTillegg>({ maskiner: [], varer: [] });

  // Ikke ansatt → ingen sedel. Fersk kontekst først, ellers sist lagrede svar.
  useEffect(() => {
    let avbrutt = false;
    if (erAnsattIValgtFirma != null) {
      setErAnsatt(erAnsattIValgtFirma);
      return;
    }
    void hentLagretAnsattStatus(orgId).then((svar) => {
      if (!avbrutt) setErAnsatt(svar);
    });
    return () => {
      avbrutt = true;
    };
  }, [erAnsattIValgtFirma, orgId]);

  // Dagen leses fra DB — kun en `paagaar`-dag kan bekreftes.
  const dag = useMemo(() => {
    const db = hentDatabase();
    if (!db || !params.arbeidsdagId) return null;
    const rad = db
      .select()
      .from(arbeidsdagLocal)
      .where(eq(arbeidsdagLocal.id, params.arbeidsdagId))
      .all()[0];
    if (!rad || rad.status !== "paagaar") return null;
    return {
      startAt: rad.startAt,
      startLat: rad.startLat,
      startLng: rad.startLng,
      oppmotestedId: rad.oppmotestedId ?? null,
      byggeplassId: rad.byggeplassId ?? null,
    };
  }, [params.arbeidsdagId]);

  // LES + REGN på nytt ved hver retting. Ingen skriving.
  const beregnet = useMemo(() => {
    const db = hentDatabase();
    if (!db || !dag || !bruker?.id || !sluttIso) return null;
    return forberedBekreftDag(
      db,
      {
        userId: bruker.id,
        orgId,
        dag,
        sluttIso,
        endLat,
        endLng,
        kontekstByggeplassId: valgtBygningId,
        aktivtProsjektId: valgtProsjektId,
        sisteSegmentKilde,
        valgtByggeplassId,
      },
      retting,
    );
  }, [dag, bruker?.id, orgId, sluttIso, endLat, endLng, valgtBygningId, valgtProsjektId, sisteSegmentKilde, valgtByggeplassId, retting]);

  const prosjekter = useMemo(() => hentProsjekterLokalt(orgId), [orgId]);
  const aktiviteter = useMemo(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(aktivitetLocal)
      .where(
        and(
          eq(aktivitetLocal.organizationId, orgId),
          eq(aktivitetLocal.aktiv, true),
        ),
      )
      .all();
  }, [orgId]);
  const prosjektId = beregnet?.forslag.prosjektId ?? null;
  const byggeplasser = useMemo(
    () => (prosjektId ? hentByggeplasserForProsjektLokalt(prosjektId) : []),
    [prosjektId],
  );

  // L3-D: vakten leser start-sedelen (om den finnes) + dagens nye rader.
  const grunnlag = useMemo(() => {
    const db = hentDatabase();
    if (!db || !beregnet || !bruker?.id) return null;
    return vaktGrunnlag(db, bruker.id, beregnet.forslag);
  }, [beregnet, bruker?.id]);

  // Prosjektbytte flytter tilleggene med; byggeplassen gjettes ikke på nytt.
  useEffect(() => {
    if (!prosjektId) return;
    setTillegg((tl) =>
      tl.maskiner.every((m) => m.projectId === prosjektId) &&
      tl.varer.every((v) => v.projectId === prosjektId)
        ? tl
        : {
            maskiner: tl.maskiner.map((m) => ({ ...m, projectId: prosjektId })),
            varer: tl.varer.map((v) =>
              v.projectId === prosjektId ? v : { ...v, projectId: prosjektId, byggeplassId: null },
            ),
          },
    );
  }, [prosjektId]);

  // Dom (57) m2/m3: det forslaget ikke lenger tillater (vare uten timer-rad på
  // startdatoen, sendt start-sedel) tas ut — Bekreft dropper aldri stille.
  const tilstand = useMemo(
    () =>
      beregnet && prosjektId
        ? tilleggTilstand(beregnet.forslag, grunnlag, prosjektId)
        : { startSendt: false, varerTillatt: false },
    [beregnet, grunnlag, prosjektId],
  );
  useEffect(() => {
    setTillegg((tl) => rensTillegg(tl, tilstand));
  }, [tilstand]);

  const rettDato = useCallback(
    (dato: string, endring: DagsforslagRettingDato) => {
      setRetting((r) => ({
        ...r,
        perDato: { ...r.perDato, [dato]: { ...r.perDato?.[dato], ...endring } },
      }));
    },
    [],
  );

  const ikkeNaa = useCallback(() => router.back(), [router]);

  const avsluttUtenTimer = useCallback(() => {
    const db = hentDatabase();
    if (!db || !params.arbeidsdagId || !sluttIso) return;
    avsluttDagUtenSedel(db, {
      arbeidsdagId: params.arbeidsdagId,
      sluttIso,
      endLat,
      endLng,
      naa: Date.now,
    });
    oppdaterTellere();
    router.back();
  }, [params.arbeidsdagId, sluttIso, endLat, endLng, oppdaterTellere, router]);

  const bekreft = useCallback(() => {
    const db = hentDatabase();
    if (!db || !beregnet || !bruker?.id || !params.arbeidsdagId || lagrer) return;
    setLagrer(true);
    try {
      const { forslag } = beregnet;
      const { handling } = bekreftDag(db, forslag, {
        userId: bruker.id,
        orgId,
        erAnsatt: erAnsatt ?? null,
        nyId: randomUUID,
        naa: Date.now,
        arbeidsdagId: params.arbeidsdagId,
        sluttIso,
        endLat,
        endLng,
      }, rensTillegg(tillegg, tilstand));
      if (handling.type === "maskinBrudd") {
        // Ingenting er skrevet — skjermen står, arbeideren justerer maskintimene.
        Alert.alert(t("timer.bekreftDag.tillegg.bruddTittel"), t("timer.maskin.overstigerArbeid"));
        return;
      }
      oppdaterTellere();
      void triggerSync();
      // Utfallene fra «Slutt dag» (H7), nå bak Bekreft.
      switch (handling.type) {
        case "suksess":
          router.replace(`/timer/${handling.sheetId}`);
          // B6.3-markør: normen var ikke dagens server-svar → si det.
          if (forslag.normStatus === "ukjent") {
            Alert.alert(
              t("timer.normMarkor.ukjent.tittel"),
              t("timer.normMarkor.ukjent.melding"),
            );
          } else if (forslag.normStatus === "cachet") {
            Alert.alert(
              t("timer.normMarkor.cachet.tittel"),
              t("timer.normMarkor.cachet.melding"),
            );
          }
          break;
        case "blokkertSendt":
          // Dagen står ÅPEN — timene reddes ved at lederen returnerer sedelen.
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(t("timer.appendSendt.tittel"), t("timer.appendSendt.melding"));
          break;
        case "playVek":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.playVek.tittel"),
            t("timer.playVek.melding", { intervaller: handling.intervaller }),
          );
          break;
        case "forKort":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t(handling.preFylt ? "timer.forKort.preFyltTittel" : "timer.forKort.tittel"),
            t(handling.preFylt ? "timer.forKort.preFyltMelding" : "timer.forKort.melding"),
          );
          break;
        case "manglerLonnsart":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(t("timer.manglerLonnsart.tittel"), t("timer.manglerLonnsart.hjelp"));
          break;
        case "ikkeAnsatt":
          Alert.alert(
            t("timer.kildeManglet.tittel"),
            t("timer.ikkeAnsatt", { firma: valgtFirma?.name ?? "" }),
          );
          break;
        case "kildeManglet":
          // A5: «Velg prosjekt» i skjermen erstatter onNyRad-fallbacken.
          Alert.alert(t("timer.kildeManglet.tittel"), t("timer.kildeManglet.melding"));
          break;
        case "prosjektUkjent":
          Alert.alert(t("timer.prosjektUkjent.tittel"), t("timer.prosjektUkjent.melding"));
          break;
      }
    } finally {
      setLagrer(false);
    }
  }, [beregnet, bruker?.id, params.arbeidsdagId, lagrer, orgId, erAnsatt, sluttIso, endLat, endLng, oppdaterTellere, triggerSync, router, t, valgtFirma?.name, tillegg, tilstand]);

  // A4-grenen (isolert): sedelen for den sendte datoen, for lenken.
  const sendtSedelId = useMemo(() => {
    if (!beregnet || !bruker?.id || !erAlleDatoerSendt(beregnet.forslag)) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ id: dagsseddelLocal.id })
        .from(dagsseddelLocal)
        .where(
          and(
            eq(dagsseddelLocal.userId, bruker.id),
            eq(dagsseddelLocal.dato, beregnet.forslag.datoer[0]!.dato),
          ),
        )
        .all()[0]?.id ?? null
    );
  }, [beregnet, bruker?.id]);

  const topp = (
    <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <Pressable onPress={ikkeNaa} hitSlop={12}>
        <ArrowLeft size={22} color="#1f2937" />
      </Pressable>
      <Text className="flex-1 text-lg font-semibold text-gray-900">
        {t("timer.bekreftDag.tittel")}
      </Text>
    </View>
  );

  if (!dag || !beregnet || erAnsatt === undefined) {
    return (
      <ModalFlate className="bg-gray-50">
        {topp}
        <View className="flex-1 items-center justify-center">
          {dag ? <ActivityIndicator /> : (
            <Text className="text-sm text-gray-500">{t("timer.bekreftDag.ingenAapenDag")}</Text>
          )}
        </View>
      </ModalFlate>
    );
  }

  const { forslag, input } = beregnet;
  const alleRader = forslag.datoer.flatMap((d) => d.rader);
  const sum = alleRader.reduce((s, r) => s + r.timer, 0);
  const forsteDag = forslag.datoer[0];
  const sisteDag = forslag.datoer[forslag.datoer.length - 1];
  const anslaatt = sisteSegmentKilde === "system" || forslag.kappet;
  const norm = forsteDag ? input.effektivPerDato[forsteDag.dato]?.dagsnorm : undefined;
  const otNivaa = new Map(
    input.alleLonnsarter.map((l) => [l.id, l.overtidsnivaa] as const),
  );
  // ORDRE 34 pkt 4: nivå-chips — kun aktive lønnsarter med overtidsnivå.
  const overtidValg = input.alleLonnsarter
    .filter((l) => l.aktiv && l.overtidsnivaa != null)
    .sort((a, b) => a.rekkefolge - b.rekkefolge)
    .map((l) => ({ id: l.id, navn: l.navn ?? `${l.overtidsnivaa}%` }));
  const prosjektNavn = prosjekter.find((p) => p.id === prosjektId)?.name ?? null;
  const aktivitetNavn =
    aktiviteter.find((a) => a.id === forslag.aktivitetId)?.navn ?? null;

  // Grenene (§ 3.1). A4 venter Kenneth: sendt dag → lesemodus, [Lukk], dagen åpen.
  const alleSendt = erAlleDatoerSendt(forslag);
  const ikkeAnsatt = erAnsatt === false;
  const tomt = !ikkeAnsatt && erTomtForslag(forslag);
  const manglerProsjekt = prosjektId == null;
  const startDato = forslag.datoer.find((d) => d.erStartSegment)?.dato ?? null;
  const kanBekrefte = !alleSendt && !ikkeAnsatt && !tomt && !manglerProsjekt && !lagrer;

  return (
    <ModalFlate className="bg-gray-50">
      {topp}
      <ScrollView contentContainerClassName="gap-3 p-4">
        {/* Topplinje: dato · start/slutt · sum · norm */}
        <View className="rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-sm font-semibold text-gray-900">
            {t("timer.bekreftDag.topplinje", {
              dato: forsteDag?.dato ?? "",
              start: tilHHMM(forsteDag?.segmentStartIso ?? dag.startAt),
              slutt: tilHHMM(sisteDag?.segmentSluttIso ?? sluttIso),
              sum: formatTimer(sum),
            })}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            {[
              anslaatt ? t("timer.bekreftDag.sluttAnslaatt") : null,
              norm != null && forslag.normStatus !== "ukjent"
                ? t("timer.bekreftDag.norm", { norm: formatTimer(norm) })
                : t("timer.normMarkor.ukjent.tittel"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {alleSendt ? (
          <View className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">{t("timer.bekreftDag.alleredeSendt")}</Text>
            {sendtSedelId ? (
              <Pressable onPress={() => router.replace(`/timer/${sendtSedelId}`)} className="mt-2">
                <Text className="text-sm font-medium text-blue-700">
                  {t("timer.bekreftDag.aapneSedel")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {ikkeAnsatt ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-800">
              {t("timer.ikkeAnsatt", { firma: valgtFirma?.name ?? "" })}
            </Text>
          </View>
        ) : null}

        {tomt ? (
          <View className="rounded-lg border border-gray-200 bg-white p-3">
            <Text className="text-sm font-semibold text-gray-900">
              {t("timer.bekreftDag.tomTittel")}
            </Text>
          </View>
        ) : null}

        {!alleSendt && !ikkeAnsatt && !tomt ? (
          <>
            {/* Prosjekt · byggeplass · aktivitet — gjelder hele dagen */}
            <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
              <Valgfelt
                etikett={t("timer.bekreftDag.prosjekt")}
                verdi={prosjektNavn ?? t("timer.bekreftDag.velgProsjekt")}
                feil={manglerProsjekt}
                onPress={() => setValgark("prosjekt")}
              />
              {!manglerProsjekt ? (
                <>
                  <Valgfelt
                    etikett={t("timer.bekreftDag.byggeplass")}
                    verdi={
                      byggeplasser.find((b) => b.id === forsteDag?.byggeplassId)?.navn ??
                      t("timer.bekreftDag.ingenByggeplass")
                    }
                    onPress={() => setValgark("byggeplass")}
                  />
                  <Valgfelt
                    etikett={t("timer.bekreftDag.aktivitet")}
                    verdi={aktivitetNavn ?? "—"}
                    onPress={() => setValgark("aktivitet")}
                  />
                </>
              ) : null}
            </View>

            {forslag.datoer.map((d) => (
              <DatoKort
                key={d.dato}
                dag={d}
                visDato={forslag.datoer.length > 1}
                fjernet={retting.perDato?.[d.dato]?.fjernArbeid === true}
                otNivaa={otNivaa}
                overtidValg={overtidValg}
                tidsrunding={input.regel?.tidsrundingMinutter ?? null}
                onRett={(endring) => rettDato(d.dato, endring)}
              />
            ))}

            {forslag.reiseAarsak || forslag.destinasjonAarsak ? (
              <Text className="px-1 text-xs text-gray-500">
                {t("timer.bekreftDag.ingenReise", {
                  aarsak: t(
                    `timer.bekreftDag.aarsak.${forslag.reiseAarsak ?? forslag.destinasjonAarsak}`,
                  ),
                })}
              </Text>
            ) : null}

            {!alleSendt && !ikkeAnsatt && !tomt && prosjektId && bruker?.id && startDato ? (
              <BekreftDagTilleggSeksjon
                orgId={orgId}
                userId={bruker.id}
                projectId={prosjektId}
                prosjektNavn={prosjektNavn ?? ""}
                dato={startDato}
                byggeplassId={entydigByggeplass(forslag, prosjektId)}
                grunnlag={grunnlag}
                tilstand={tilstand}
                tillegg={tillegg}
                onEndre={setTillegg}
              />
            ) : null}

            <Text className="px-1 text-xs text-gray-500">{t("timer.bekreftDag.hjelp")}</Text>
          </>
        ) : null}
      </ScrollView>

      {/* Handlinger */}
      <View className="gap-2 border-t border-gray-200 bg-white p-4">
        {alleSendt ? (
          <Knapp tekst={t("handling.lukk")} onPress={ikkeNaa} sekundaer />
        ) : ikkeAnsatt || tomt ? (
          <>
            <Knapp
              tekst={t(ikkeAnsatt ? "timer.bekreftDag.avsluttUtenTimer" : "timer.bekreftDag.avsluttDag")}
              onPress={avsluttUtenTimer}
            />
            <Knapp tekst={t("timer.bekreftDag.ikkeNaa")} onPress={ikkeNaa} sekundaer />
          </>
        ) : (
          <>
            <Knapp
              tekst={t("timer.bekreftDag.bekreft")}
              onPress={bekreft}
              deaktivert={!kanBekrefte}
              laster={lagrer}
            />
            <Knapp tekst={t("timer.bekreftDag.ikkeNaa")} onPress={ikkeNaa} sekundaer />
          </>
        )}
      </View>

      <Valgliste
        synlig={valgark === "prosjekt"}
        tittel={t("timer.bekreftDag.prosjekt")}
        valg={prosjekter.map((p) => ({ id: p.id, navn: p.name }))}
        valgtId={prosjektId}
        onVelg={(id) => {
          // Nytt prosjekt → byggeplassen tilhørte det gamle; A5 velger på nytt.
          setValgtByggeplassId(undefined);
          setRetting((r) => ({ ...r, prosjektId: id ?? undefined, byggeplassId: undefined }));
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
      <Valgliste
        synlig={valgark === "byggeplass"}
        tittel={t("timer.bekreftDag.byggeplass")}
        valg={byggeplasser.map((b) => ({ id: b.id, navn: b.navn ?? "" }))}
        ingenValg={t("timer.bekreftDag.ingenByggeplass")}
        valgtId={forsteDag?.byggeplassId ?? null}
        onVelg={(id) => {
          setValgtByggeplassId(id ?? undefined);
          setRetting((r) => ({ ...r, byggeplassId: id }));
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
      <Valgliste
        synlig={valgark === "aktivitet"}
        tittel={t("timer.bekreftDag.aktivitet")}
        valg={aktiviteter.map((a) => ({ id: a.id, navn: a.navn }))}
        valgtId={forslag.aktivitetId}
        onVelg={(id) => {
          setRetting((r) => ({ ...r, aktivitetId: id ?? undefined }));
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
    </ModalFlate>
  );
}

/** Ett kort pr. dato: reise ut · arbeid (fra/til, OT, fjern) · pause · reise retur. */
function DatoKort({
  dag,
  visDato,
  fjernet,
  otNivaa,
  overtidValg,
  tidsrunding,
  onRett,
}: {
  dag: DagsforslagDag;
  visDato: boolean;
  fjernet: boolean;
  otNivaa: Map<string, number | null>;
  overtidValg: Array<{ id: string; navn: string }>;
  tidsrunding: number | null;
  onRett: (endring: DagsforslagRettingDato) => void;
}) {
  const { t } = useTranslation();
  const [redigerOvertid, setRedigerOvertid] = useState(false);
  const arbeid = dag.rader.filter((r) => !r.erReise);
  const ut = dag.rader.find((r) => r.erReise && r.reiseRetning === "ut");
  const retur = dag.rader.find((r) => r.erReise && r.reiseRetning === "retur");
  const arbeidTimer = arbeid.reduce((s, r) => s + r.timer, 0);
  const forsteOt = arbeid.find((r) => otNivaa.get(r.lonnsartId) != null);
  // Fra/til vises fra radene; ved «fjernet» fra arbeidsvinduet mellom reisene.
  const fra = arbeid[0]?.fraTid ?? ut?.tilTid ?? tilHHMM(dag.segmentStartIso);
  const til = arbeid[arbeid.length - 1]?.tilTid ?? retur?.fraTid ?? tilHHMM(dag.segmentSluttIso);

  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {visDato ? <Text className="text-xs font-semibold text-gray-500">{dag.dato}</Text> : null}
      {ut ? <ReiseLinje rad={ut} tekst={t("timer.bekreftDag.reiseUt")} /> : null}

      {fjernet ? (
        <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-2">
          <Text className="flex-1 text-sm text-gray-500">{t("timer.bekreftDag.arbeidFjernet")}</Text>
          <Pressable onPress={() => onRett({ fjernArbeid: false })} hitSlop={8} className="flex-row items-center gap-1">
            <Undo2 size={16} color="#1d4ed8" />
            <Text className="text-sm font-medium text-blue-700">{t("timer.bekreftDag.angre")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2 rounded-md bg-gray-50 p-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-900">
              {t("timer.bekreftDag.arbeid", { timer: formatTimer(arbeidTimer) })}
            </Text>
            <Pressable onPress={() => onRett({ fjernArbeid: true })} hitSlop={8}>
              <Trash2 size={18} color="#dc2626" />
            </Pressable>
          </View>
          <FraTilTidFelt
            fraTid={fra}
            tilTid={til}
            tidsrundingMinutter={tidsrunding}
            onFraEndret={(hhmm) => onRett({ arbeidFra: hhmm })}
            onTilEndret={(hhmm) => onRett({ arbeidTil: hhmm })}
          />
          {forsteOt?.fraTid ? (
            <Pressable
              onPress={() => setRedigerOvertid((v) => !v)}
              accessibilityHint={t("timer.bekreftDag.overtidRedigerHint")}
              className="self-start rounded bg-amber-100 px-2 py-0.5"
            >
              <Text className="text-xs font-medium text-amber-800">
                {t("timer.bekreftDag.overtid", {
                  nivaa: otNivaa.get(forsteOt.lonnsartId),
                  fra: forsteOt.fraTid,
                })}
              </Text>
            </Pressable>
          ) : null}
          {/* ORDRE 35 del B: ingen overtid ennå → start den fra arbeidsstart; samme motor
              (segmenterVedOvertidFra), nivå faller tilbake til OT50 til et chip velges. */}
          {!forsteOt && overtidValg.length > 0 ? (
            <Pressable
              onPress={() => {
                onRett({ overtidFra: fra });
                setRedigerOvertid(true);
              }}
              hitSlop={8}
              className="flex-row items-center gap-1 self-start"
            >
              <Plus size={14} color="#1d4ed8" />
              <Text className="text-xs font-medium text-blue-700">
                {t("timer.bekreftDag.overtidLeggTil")}
              </Text>
            </Pressable>
          ) : null}
          {redigerOvertid && forsteOt?.fraTid ? (
            <View className="gap-2 rounded-md border border-amber-200 bg-white p-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">{t("timer.bekreftDag.overtidFra")}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(forsteOt.fraTid!, -1, fra, til, tidsrunding) })
                    }
                    hitSlop={8}
                    className="rounded-full border border-gray-300 p-1"
                  >
                    <Minus size={16} color="#374151" />
                  </Pressable>
                  <Text className="w-16 text-center text-sm text-gray-900">{forsteOt.fraTid}</Text>
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(forsteOt.fraTid!, 1, fra, til, tidsrunding) })
                    }
                    hitSlop={8}
                    className="rounded-full border border-gray-300 p-1"
                  >
                    <Plus size={16} color="#374151" />
                  </Pressable>
                </View>
              </View>
              <Text className="text-sm text-gray-700">{t("timer.bekreftDag.overtidNivaa")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {overtidValg.map((l) => {
                  const valgt = l.id === forsteOt.lonnsartId;
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => onRett({ overtidLonnsartId: l.id })}
                      className={`rounded-full border px-3 py-1 ${valgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
                    >
                      <Text className={`text-xs ${valgt ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                        {l.navn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-700">{t("timer.bekreftDag.pause")}</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => onRett({ pauseMin: Math.max(0, dag.pauseMin - PAUSE_STEG) })}
                disabled={dag.pauseMin <= 0}
                hitSlop={8}
                className="rounded-full border border-gray-300 p-1 disabled:opacity-40"
              >
                <Minus size={16} color="#374151" />
              </Pressable>
              <Text className="w-16 text-center text-sm text-gray-900">
                {t("timer.bekreftDag.minutter", { min: dag.pauseMin })}
              </Text>
              <Pressable
                onPress={() => onRett({ pauseMin: Math.min(PAUSE_MAKS, dag.pauseMin + PAUSE_STEG) })}
                disabled={dag.pauseMin >= PAUSE_MAKS}
                hitSlop={8}
                className="rounded-full border border-gray-300 p-1 disabled:opacity-40"
              >
                <Plus size={16} color="#374151" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {retur ? <ReiseLinje rad={retur} tekst={t("timer.bekreftDag.reiseRetur")} /> : null}
    </View>
  );
}

function ReiseLinje({ rad, tekst }: { rad: DagsforslagRad; tekst: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Car size={14} color="#6b7280" />
      <Text className="flex-1 text-xs text-gray-600">
        {t("timer.bekreftDag.reiseLinje", {
          retning: tekst,
          fra: rad.fraTid ?? "",
          til: rad.tilTid ?? "",
          min: rad.reiseKjoretidMin ?? Math.round(rad.timer * 60),
        })}
      </Text>
    </View>
  );
}

function Valgfelt({
  etikett,
  verdi,
  feil = false,
  onPress,
}: {
  etikett: string;
  verdi: string;
  feil?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-md border px-3 py-2 ${feil ? "border-red-400 bg-red-50" : "border-gray-200"}`}
    >
      <Text className="text-xs text-gray-500">{etikett}</Text>
      <Text className={`ml-3 flex-1 text-right text-sm font-medium ${feil ? "text-red-700" : "text-gray-900"}`}>
        {verdi}
      </Text>
    </Pressable>
  );
}

function Valgliste({
  synlig,
  tittel,
  valg,
  valgtId,
  ingenValg,
  onVelg,
  onLukk,
}: {
  synlig: boolean;
  tittel: string;
  valg: { id: string; navn: string }[];
  valgtId: string | null;
  /** Satt = egen rad øverst som velger «ingen» (null). */
  ingenValg?: string;
  onVelg: (id: string | null) => void;
  onLukk: () => void;
}) {
  const insets = useModalInnsetter();
  const alle: { id: string | null; navn: string }[] = ingenValg
    ? [{ id: null, navn: ingenValg }, ...valg]
    : valg;
  return (
    <Modal visible={synlig} animationType="slide" transparent onRequestClose={onLukk}>
      <Pressable className="flex-1 bg-black/30" onPress={onLukk} />
      <View className="max-h-[70%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom }}>
        <Text className="px-4 pb-2 pt-4 text-base font-semibold text-gray-900">{tittel}</Text>
        <ScrollView>
          {alle.map((v) => (
            <Pressable
              key={v.id ?? "ingen"}
              onPress={() => onVelg(v.id)}
              className={`border-t border-gray-100 px-4 py-3 ${v.id === valgtId ? "bg-blue-50" : ""}`}
            >
              <Text className={`text-sm ${v.id === valgtId ? "font-semibold text-blue-700" : "text-gray-900"}`}>
                {v.navn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Knapp({
  tekst,
  onPress,
  sekundaer = false,
  deaktivert = false,
  laster = false,
}: {
  tekst: string;
  onPress: () => void;
  sekundaer?: boolean;
  deaktivert?: boolean;
  laster?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deaktivert}
      className={`flex-row items-center justify-center gap-2 rounded-lg py-3 disabled:opacity-50 ${
        sekundaer ? "border border-gray-300 bg-white active:bg-gray-100" : "bg-blue-600 active:bg-blue-700"
      }`}
    >
      {laster ? <ActivityIndicator size="small" color="#ffffff" /> : null}
      <Text className={`text-base font-semibold ${sekundaer ? "text-gray-800" : "text-white"}`}>
        {tekst}
      </Text>
    </Pressable>
  );
}
