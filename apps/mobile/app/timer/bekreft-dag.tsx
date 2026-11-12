import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  InputAccessoryView,
  type TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, Car, ChevronRight, Minus, Plus, Trash2, Undo2 } from "lucide-react-native";
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
import {
  hentByggeplasserForProsjektLokalt,
  identifiserByggeplass,
} from "../../src/services/byggeplassKatalog";
import { hentUnderprosjekterLokalt } from "../../src/services/timerKatalog";
import { FraTilTidFelt } from "../../src/components/timer-detalj/FraTilTidFelt";
import { ModalFlate } from "../../src/components/ModalFlate";
import { useModalInnsetter } from "../../src/components/ModalInnsetter";
import {
  forberedBekreftDag,
  bekreftDag,
  avsluttDagUtenSedel,
  erTomtForslag,
  erAlleDatoerSendt,
  sendteDatoer,
  visSluttTid,
  bekreftSperre,
  stegSluttIso,
  manglerBeskrivelse,
  prosjekterMedArbeid,
  flyttBeskrivelse,
  flyttBeskrivelseVedProsjektbytte,
} from "../../src/utils/bekreftDag";
import { forberedManuellDag } from "../../src/utils/manuellDag";
import { DatoVelgerFelt } from "../../src/components/DatoVelgerFelt";
import { formatNorskDato, lokalIsoDato } from "../../src/utils/dato";
import { BekreftDagBeskrivelse } from "../../src/components/timer-detalj/BekreftDagBeskrivelse";
import { kortMedArbeid, arbeidsraderPerKort, RAD_PREFIKS } from "../../src/utils/beskrivelseKort";
import { kortNokkel } from "../../src/lib/prosjektkortMobil";
import { sisteBeskrivelser, beskrivelseChips } from "../../src/services/beskrivelseForslag";
import {
  vaktGrunnlag,
  entydigByggeplass,
  tilleggTilstand,
  rensTillegg,
  type BekreftDagTillegg,
} from "../../src/utils/bekreftDagTillegg";
import { BekreftDagTilleggSeksjon } from "../../src/components/timer-detalj/BekreftDagTilleggSeksjon";
import {
  leggTilOvertidRetting,
  overtidEditorFra,
  stegOvertidFra,
} from "../../src/utils/dagsforslag";
import type {
  DagsforslagRetting,
  DagsforslagRettingDato,
  DagsforslagDag,
  DagsforslagRad,
  DagsforslagLonnsart,
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
 *
 * ORDRE 36c — MANUELL modus (`opprinnelse=manuell`, «+» og «+ Nytt
 * prosjektkort»): samme skjerm uten GPS og uten arbeidsdag. Datoen er valgt på
 * forhånd og kan byttes (ikke fra et prosjektkort: `laastDato`). Finnes en
 * dagsseddel den datoen, legges registreringen inn i den (`bekreftDag`).
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

/** RETUR 36c pkt 3: iOS «Ferdig»-linje over tastaturet for «Hva gjorde du i dag?». */
const TASTATUR_ID = "bekreftDagTastatur";

export default function BekreftDagSkjerm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    arbeidsdagId: string;
    sluttIso: string;
    endLat?: string;
    endLng?: string;
    sisteSegmentKilde?: string;
    opprinnelse?: string;
    dato?: string;
    laastDato?: string;
  }>();
  const manuell = params.opprinnelse === "manuell";
  const laastDato = params.laastDato === "1";
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
  const [manuellDato, setManuellDato] = useState(params.dato ?? lokalIsoDato(new Date()));
  const [visDatoVelger, setVisDatoVelger] = useState(false);
  // A2: byggeplassvalget kjører lese-fasen på nytt (kun select).
  const [valgtByggeplassId, setValgtByggeplassId] = useState<
    string | null | undefined
  >(undefined);
  const [erAnsatt, setErAnsatt] = useState<boolean | null | undefined>(undefined);
  const [valgark, setValgark] = useState<Valgark>(null);
  const [lagrer, setLagrer] = useState(false);
  // DEL 5 c: anslått slutt må godkjennes («Tidene stemmer») eller rettes før lagring.
  const [sluttGodkjent, setSluttGodkjent] = useState(false);
  const [rettetSluttIso, setRettetSluttIso] = useState<string | null>(null);
  // L3-D: maskin og varer holdes i minnet til Bekreft (spec § 3.5).
  const [tillegg, setTillegg] = useState<BekreftDagTillegg>({ maskiner: [], varer: [] });
  // ORDRE 36a: feltet er nøytralt til første Bekreft-forsøk med tom beskrivelse.
  const [forsoktBekreft, setForsoktBekreft] = useState(false);
  const rulleRef = useRef<ScrollView>(null);
  const beskrivelseFelt = useRef(new Map<string, TextInput>());
  const beskrivelseY = useRef(new Map<string, number>());
  // RETUR 36c-2 (D4): tekstfeltets y innenfor kortet — rullemålet er feltet.
  const beskrivelseFeltY = useRef(new Map<string, number>());
  // Radform: radfeltene inne i kortet (nøkkel `rad:…`).
  const radFelt = useRef(new Map<string, TextInput>());
  const radY = useRef(new Map<string, number>());
  const [tastaturOppe, setTastaturOppe] = useState(false);
  useEffect(() => {
    const vis = Keyboard.addListener("keyboardDidShow", () => setTastaturOppe(true));
    const skjul = Keyboard.addListener("keyboardDidHide", () => setTastaturOppe(false));
    return () => {
      vis.remove();
      skjul.remove();
    };
  }, []);

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
    if (!db || manuell || !params.arbeidsdagId) return null;
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
  }, [manuell, params.arbeidsdagId]);

  // LES + REGN på nytt ved hver retting. Ingen skriving.
  const beregnet = useMemo(() => {
    const db = hentDatabase();
    if (!db || !bruker?.id) return null;
    if (manuell) {
      return forberedManuellDag(
        db,
        {
          userId: bruker.id,
          orgId,
          dato: manuellDato,
          kontekstByggeplassId: valgtBygningId,
          aktivtProsjektId: valgtProsjektId,
          valgtByggeplassId,
        },
        retting,
      );
    }
    if (!dag || !sluttIso) return null;
    // DEL 5 c: arbeiderens rettede slutt erstatter anslaget — kilden er da arbeideren.
    const brukSluttIso = rettetSluttIso ?? sluttIso;
    const lest = forberedBekreftDag(
      db,
      {
        userId: bruker.id,
        orgId,
        dag,
        sluttIso: brukSluttIso,
        endLat,
        endLng,
        kontekstByggeplassId: valgtBygningId,
        aktivtProsjektId: valgtProsjektId,
        sisteSegmentKilde: rettetSluttIso ? "bruker" : sisteSegmentKilde,
        valgtByggeplassId,
      },
      retting,
    );
    return { ...lest, sluttIso: brukSluttIso };
  }, [manuell, manuellDato, dag, bruker?.id, orgId, sluttIso, rettetSluttIso, endLat, endLng, valgtBygningId, valgtProsjektId, sisteSegmentKilde, valgtByggeplassId, retting]);
  // DEL 5 c: panelet for anslått slutt — GPS-veien, slutten satt av systemet
  // (glemt dag) eller kappet. Står også etter retting, så arbeideren ser tiden.
  const sluttPanel =
    !manuell &&
    beregnet != null &&
    (sisteSegmentKilde === "system" || beregnet.forslag.kappet || rettetSluttIso != null);
  const sluttIkkeGodkjent = sluttPanel && !sluttGodkjent && rettetSluttIso == null;
  // Manuell: sluttiden er utledet (`manuellDag`), ikke en slutt-GPS.
  const effSluttIso = beregnet?.sluttIso ?? sluttIso;

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

  // ORDRE 36a/36b: ett beskrivelsesfelt pr. kort med arbeid; chips pr. prosjekt fra lokal DB.
  const arbeidProsjekter = useMemo(
    () => (beregnet ? prosjekterMedArbeid(beregnet.forslag) : []),
    [beregnet],
  );
  const arbeidKort = useMemo(
    () => (beregnet ? kortMedArbeid(beregnet.forslag) : []),
    [beregnet],
  );
  const manglerNokler = useMemo(
    () => (beregnet ? manglerBeskrivelse(beregnet.forslag) : []),
    [beregnet],
  );
  const raderPerKort = useMemo(
    () => (beregnet ? arbeidsraderPerKort(beregnet.forslag) : new Map<string, never[]>()),
    [beregnet],
  );
  const chipDato = beregnet?.forslag.datoer[0]?.dato ?? null;
  const aktivitetIdForChip = beregnet?.forslag.aktivitetId ?? null;
  const beskrivelseChipsPerProsjekt = useMemo(() => {
    const db = hentDatabase();
    const ut = new Map<string, string[]>();
    if (!db || !bruker?.id || !chipDato) return ut;
    const aktivitet = aktiviteter.find((a) => a.id === aktivitetIdForChip)?.navn ?? null;
    for (const p of arbeidProsjekter) {
      const siste = sisteBeskrivelser(db, { userId: bruker.id, projectId: p, dato: chipDato });
      ut.set(p, beskrivelseChips(siste, aktivitet));
    }
    return ut;
  }, [arbeidProsjekter, bruker?.id, chipDato, aktiviteter, aktivitetIdForChip]);

  const settBeskrivelse = useCallback((nokkel: string, tekst: string) => {
    setRetting((r) => ({ ...r, beskrivelse: { ...r.beskrivelse, [nokkel]: tekst } }));
  }, []);
  const raderPerKortRef = useRef(raderPerKort);
  raderPerKortRef.current = raderPerKort;
  const settRadBeskrivelse = useCallback((nokkel: string, tekst: string) => {
    setRetting((r) => ({ ...r, beskrivelsePerRad: { ...r.beskrivelsePerRad, [nokkel]: tekst } }));
  }, []);

  // Rød ramme + rull til første tomme felt + fokus. Ingen Alert, ingen toast.
  const visTomBeskrivelse = useCallback((nokler: string[]) => {
    setForsoktBekreft(true);
    const forste = nokler[0];
    if (!forste) return;
    // Radform (beslutning 3): en radnøkkel ruller til radfeltet i sitt kort.
    if (forste.startsWith(RAD_PREFIKS)) {
      const kort = [...raderPerKortRef.current.entries()].find(([, rader]) =>
        rader.some((r) => r.nokkel === forste),
      )?.[0];
      const kortY = kort ? beskrivelseY.current.get(kort) : undefined;
      const y = kortY != null ? kortY + (radY.current.get(forste) ?? 0) : undefined;
      if (y != null) rulleRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
      radFelt.current.get(forste)?.focus();
      return;
    }
    const y = beskrivelseY.current.get(forste);
    if (y != null) rulleRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    beskrivelseFelt.current.get(forste)?.focus();
  }, []);
  // RETUR 36c pkt 3: feltet det skrives i ruller over tastaturet når det er oppe.
  // RETUR 36c-2 (D4): målet er selve tekstfeltet (kortets y + feltets y), ikke
  // kortets topp — chips over feltet ruller ut av syne og kan ikke treffes.
  const rullTilBeskrivelse = useCallback((nokkel: string) => {
    const rull = () => {
      const y = beskrivelseY.current.get(nokkel);
      if (y == null) return;
      const feltY = beskrivelseFeltY.current.get(nokkel) ?? 0;
      rulleRef.current?.scrollTo({ y: Math.max(0, y + feltY - 16), animated: true });
    };
    if (Keyboard.isVisible()) {
      rull();
      return;
    }
    const lytter = Keyboard.addListener("keyboardDidShow", () => {
      lytter.remove();
      rull();
    });
    setTimeout(() => lytter.remove(), 1500);
  }, []);
  const byggeplasser = useMemo(
    () => (prosjektId ? hentByggeplasserForProsjektLokalt(prosjektId) : []),
    [prosjektId],
  );
  // ORDRE 36c (rettelse S2): valgfritt underprosjekt i manuell modus. Vises når
  // prosjektet har aktive underprosjekter (K3, til firmavalget i 36d-2). Tomt
  // ved åpning, forhåndsvelges aldri; nytt trykk på valgt chip tømmer.
  const underprosjekter = useMemo(
    () =>
      manuell && prosjektId
        ? hentUnderprosjekterLokalt(prosjektId)
            .map((e) => ({ id: e.id, navn: `${e.proAdmId} — ${e.kortNavn}` }))
            .sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true }))
        : [],
    [manuell, prosjektId],
  );
  const [ecoId, setEcoId] = useState<string | null>(null);
  useEffect(() => setEcoId(null), [prosjektId]);

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
      sluttSted: identifiserByggeplass(endLat, endLng, orgId),
      nyId: randomUUID,
    });
    oppdaterTellere();
    router.back();
  }, [params.arbeidsdagId, sluttIso, endLat, endLng, orgId, oppdaterTellere, router]);

  const bekreft = useCallback(() => {
    const db = hentDatabase();
    // Dobbelttrykk mens lagring pågår: knappen viser laste-indikator.
    if (lagrer) return;
    // DEL 5 a: ingen sperre er stille — hver sier hva som mangler.
    const sperre = bekreftSperre({
      harDb: db != null,
      harBeregnet: beregnet != null,
      harBruker: !!bruker?.id,
      manuell,
      harArbeidsdagId: !!params.arbeidsdagId,
      manglerProsjekt: beregnet?.forslag.prosjektId == null,
      sluttIkkeGodkjent,
    });
    if (sperre || !db || !beregnet || !bruker?.id) {
      Alert.alert(
        t("timer.bekreftDag.sperre.tittel"),
        t(`timer.bekreftDag.sperre.${sperre ?? "ikkeKlar"}`),
      );
      return;
    }
    // ORDRE 36a: påkrevd beskrivelse — sperren står FØR noe skrives.
    const tomme = manglerBeskrivelse(beregnet.forslag);
    if (tomme.length > 0) {
      visTomBeskrivelse(tomme);
      return;
    }
    setLagrer(true);
    try {
      const { forslag } = beregnet;
      const { handling } = bekreftDag(db, forslag, {
        userId: bruker.id,
        orgId,
        erAnsatt: erAnsatt ?? null,
        nyId: randomUUID,
        naa: Date.now,
        arbeidsdagId: manuell ? null : params.arbeidsdagId,
        ecoId: manuell ? ecoId : null,
        // RETUR 36c-3: eksplisitt «Ingen byggeplass» i manuell modus løfter
        // arven på en eksisterende sedel med byggeplass. GPS-veien: som før.
        utenByggeplassValgt: manuell && retting.byggeplassId === null,
        sluttIso: effSluttIso,
        endLat,
        endLng,
        sluttSted: manuell ? null : identifiserByggeplass(endLat, endLng, orgId),
      }, rensTillegg(tillegg, tilstand));
      if (handling.type === "maskinBrudd") {
        // Ingenting er skrevet — skjermen står, arbeideren justerer maskintimene.
        Alert.alert(t("timer.bekreftDag.tillegg.bruddTittel"), t("timer.maskin.overstigerArbeid"));
        return;
      }
      if (handling.type === "manglerBeskrivelse") {
        // Sikkerhetsnett — ingenting er skrevet, skjermen står.
        visTomBeskrivelse(handling.nokler);
        return;
      }
      oppdaterTellere();
      void triggerSync();
      // Utfallene fra «Slutt dag» (H7), nå bak Bekreft.
      switch (handling.type) {
        case "suksess":
          // Fra prosjektkortet (låst dato): tilbake dit — kortet leser på nytt ved fokus.
          if (laastDato) router.back();
          else router.replace(`/timer/${handling.sheetId}`);
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
        case "delvisSendt":
          // DEL 5 a: noe ble lagret, noe ble stoppet av en sendt sedel — økten er lukket.
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.delvisSendt.tittel"),
            t("timer.delvisSendt.melding", {
              lagret: handling.lagret.map(formatNorskDato).join(", "),
              blokkert: handling.blokkert.map(formatNorskDato).join(", "),
            }),
          );
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
  }, [beregnet, bruker?.id, manuell, laastDato, ecoId, params.arbeidsdagId, lagrer, orgId, erAnsatt, effSluttIso, endLat, endLng, oppdaterTellere, triggerSync, router, t, valgtFirma?.name, tillegg, tilstand, visTomBeskrivelse, retting.byggeplassId, sluttIkkeGodkjent]);

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
        {t(manuell ? "timer.bekreftDag.manuell.tittel" : "timer.bekreftDag.tittel")}
      </Text>
    </View>
  );

  if ((!manuell && !dag) || !beregnet || erAnsatt === undefined) {
    return (
      <ModalFlate className="bg-gray-50">
        {topp}
        <View className="flex-1 items-center justify-center">
          {dag || manuell ? <ActivityIndicator /> : (
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
  const anslaatt = !manuell && (sisteSegmentKilde === "system" || forslag.kappet);
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
  // DEL 5 a: datoer med sendt sedel vises FØR lagring — timene der lagres ikke.
  const sendte = sendteDatoer(forslag);
  // DEL 5 d-tillegg: hver dato med timer blir et eget prosjektkort (egen sedel, egen rad).
  const kortPrDato = forslag.datoer.filter((d) => !d.blokkert && d.rader.length > 0).length;
  const startIso = forsteDag?.segmentStartIso ?? dag?.startAt ?? "";
  const slutt = visSluttTid(startIso, sisteDag?.segmentSluttIso ?? effSluttIso ?? startIso);
  const sluttTekst = slutt.dato ? `${kortDato(slutt.dato)} ${slutt.tid}` : slutt.tid;
  const flyttSlutt = (stegMin: number) => {
    if (!dag) return;
    setRettetSluttIso(
      stegSluttIso(sisteDag?.segmentSluttIso ?? effSluttIso ?? dag.startAt, dag.startAt, stegMin),
    );
    // Tidsrettingene hørte til forrige slutt.
    setRetting((r) => ({ ...r, perDato: undefined }));
  };

  return (
    <ModalFlate className="bg-gray-50">
      {topp}
      <ScrollView
        ref={rulleRef}
        contentContainerClassName="gap-3 p-4"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        {manuell && !laastDato ? (
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.dato")}</Text>
            <Pressable
              onPress={() => setVisDatoVelger((v) => !v)}
              className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Calendar size={18} color="#6b7280" />
                <Text className="text-base text-gray-900">{formatNorskDato(manuellDato)}</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Pressable>
            {visDatoVelger && (
              <DatoVelgerFelt
                value={new Date(`${manuellDato}T00:00:00`)}
                mode="date"
                iosDisplay="inline"
                onChange={(_, valgt) => {
                  if (Platform.OS !== "ios") setVisDatoVelger(false); // Android lukker selv
                  if (!valgt) return;
                  const ny = lokalIsoDato(valgt);
                  if (ny === manuellDato) return;
                  setManuellDato(ny);
                  // Tidsrettingene hørte til forrige dato; prosjekt og beskrivelse følger med.
                  setRetting((r) => ({ ...r, perDato: undefined }));
                }}
                onLukk={() => setVisDatoVelger(false)}
              />
            )}
          </View>
        ) : null}

        {/* Topplinje: dato · start/slutt · sum · norm */}
        <View className="rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-sm font-semibold text-gray-900">
            {t("timer.bekreftDag.topplinje", {
              dato: forsteDag?.dato ?? "",
              start: tilHHMM(startIso),
              slutt: sluttTekst,
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

        {sluttPanel ? (
          // DEL 5 c: anslått slutt — godkjennes eller rettes før noe lagres.
          <View
            className={`gap-2 rounded-lg border p-3 ${
              sluttIkkeGodkjent ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
            }`}
          >
            <Text className="text-sm font-semibold text-gray-900">
              {t(rettetSluttIso ? "timer.bekreftDag.slutt.rettet" : "timer.bekreftDag.slutt.anslaatt", {
                slutt: sluttTekst,
              })}
            </Text>
            <Text className="text-xs text-gray-600">{t("timer.bekreftDag.slutt.hjelp")}</Text>
            <View className="flex-row gap-2">
              {[-60, -15, 15, 60].map((steg) => (
                <Pressable
                  key={steg}
                  onPress={() => flyttSlutt(steg)}
                  className="min-h-[40px] flex-1 items-center justify-center rounded-md border border-gray-300 bg-white active:bg-gray-100"
                >
                  <Text className="text-sm text-gray-800">
                    {t(`timer.bekreftDag.slutt.steg.${steg < 0 ? "minus" : "pluss"}${Math.abs(steg)}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {sluttIkkeGodkjent ? (
              <Pressable
                onPress={() => setSluttGodkjent(true)}
                className="min-h-[44px] items-center justify-center rounded-md bg-amber-600 active:bg-amber-700"
              >
                <Text className="text-sm font-semibold text-white">
                  {t("timer.bekreftDag.slutt.godkjenn")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {alleSendt ? (
          <View className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">{t("timer.bekreftDag.alleredeSendt")}</Text>
            {sendte.map((dato) => (
              <Text key={dato} className="mt-1 text-sm text-amber-900">
                {t("timer.bekreftDag.datoSendt", { dato: kortDato(dato) })}
              </Text>
            ))}
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
                  {underprosjekter.length > 0 ? (
                    <View className="gap-1">
                      <Text className="text-sm text-gray-500">{t("timer.felt.underprosjekt")}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {underprosjekter.map((e) => {
                          const valgt = ecoId === e.id;
                          return (
                            <Pressable
                              key={e.id}
                              onPress={() => setEcoId(valgt ? null : e.id)}
                              accessibilityState={{ selected: valgt }}
                              className={`min-h-[36px] justify-center rounded-full border px-3 ${
                                valgt ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white active:bg-gray-50"
                              }`}
                            >
                              <Text className={`text-sm ${valgt ? "text-white" : "text-gray-700"}`}>{e.navn}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  <Valgfelt
                    etikett={t("timer.bekreftDag.aktivitet")}
                    verdi={aktivitetNavn ?? "—"}
                    onPress={() => setValgark("aktivitet")}
                  />
                </>
              ) : null}
            </View>

            {kortPrDato > 1 ? (
              <Text className="px-1 text-xs text-gray-600">
                {t("timer.bekreftDag.kortPrDato", { antall: kortPrDato })}
              </Text>
            ) : null}

            {forslag.datoer.map((d) =>
              d.blokkert ? (
                // DEL 5 a: sendt dato — vises før lagring, timene her lagres ikke.
                <View key={d.dato} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <Text className="text-sm text-amber-900">
                    {t("timer.bekreftDag.datoSendt", { dato: kortDato(d.dato) })}
                  </Text>
                </View>
              ) : (
              <DatoKort
                key={d.dato}
                dag={d}
                visDato={forslag.datoer.length > 1}
                fjernet={retting.perDato?.[d.dato]?.fjernArbeid === true}
                otNivaa={otNivaa}
                overtidValg={overtidValg}
                alleLonnsarter={input.alleLonnsarter}
                rettetOvertidFra={retting.perDato?.[d.dato]?.overtidFra}
                tidsrunding={input.regel?.tidsrundingMinutter ?? null}
                onRett={(endring) => rettDato(d.dato, endring)}
              />
              ),
            )}

            {arbeidKort.map((k) => (
              <BekreftDagBeskrivelse
                key={k.nokkel}
                ref={(felt) => {
                  if (felt) beskrivelseFelt.current.set(k.nokkel, felt);
                  else beskrivelseFelt.current.delete(k.nokkel);
                }}
                onLayout={(e) => beskrivelseY.current.set(k.nokkel, e.nativeEvent.layout.y)}
                tastaturId={TASTATUR_ID}
                onFokus={() => rullTilBeskrivelse(k.nokkel)}
                onFeltY={(y) => beskrivelseFeltY.current.set(k.nokkel, y)}
                onInnholdEndret={() => rullTilBeskrivelse(k.nokkel)}
                prosjektNavn={
                  [
                    prosjekter.find((pr) => pr.id === k.projectId)?.name ?? null,
                    // Flere kort på samme prosjekt → byggeplassen skiller feltene.
                    k.delerProsjekt
                      ? (k.byggeplassId
                          ? hentByggeplasserForProsjektLokalt(k.projectId).find(
                              (b) => b.id === k.byggeplassId,
                            )?.navn
                          : null) ?? t("timer.kortValg.utenByggeplass")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
                visProsjekt={arbeidKort.length > 1}
                verdi={retting.beskrivelse?.[k.nokkel] ?? ""}
                chips={beskrivelseChipsPerProsjekt.get(k.projectId) ?? []}
                visFeil={forsoktBekreft && manglerNokler.includes(k.nokkel)}
                onEndre={(tekst) => settBeskrivelse(k.nokkel, tekst)}
                rader={(raderPerKort.get(k.nokkel) ?? []).map((r) => ({
                  nokkel: r.nokkel,
                  tid: r.fraTid && r.tilTid ? `${r.fraTid}–${r.tilTid}` : t("timer.dagsoversikt.utenTid"),
                  verdi: retting.beskrivelsePerRad?.[r.nokkel] ?? "",
                  visFeil: forsoktBekreft && manglerNokler.includes(r.nokkel),
                }))}
                onEndreRad={settRadBeskrivelse}
                radRef={(nokkel, felt) => {
                  if (felt) radFelt.current.set(nokkel, felt);
                  else radFelt.current.delete(nokkel);
                }}
                onRadY={(nokkel, y) => radY.current.set(nokkel, y)}
              />
            ))}

            {/* RETUR 36c pkt 4: manuell føring bruker aldri GPS — ingen reise-årsak. */}
            {!manuell && (forslag.reiseAarsak || forslag.destinasjonAarsak) ? (
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

            <Text className="px-1 text-xs text-gray-500">
              {t(manuell ? "timer.bekreftDag.manuell.hjelp" : "timer.bekreftDag.hjelp")}
            </Text>
          </>
        ) : null}
        {/* RETUR 36c-2 (D4): luft under siste felt mens tastaturet er oppe, så
            rullingen til feltet ikke klemmes mot bunnen. */}
        {tastaturOppe ? <View className="h-[120px]" /> : null}
      </ScrollView>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={TASTATUR_ID}>
          <View className="border-t border-gray-200 bg-gray-100 px-4 py-2">
            <Pressable
              onPress={() => Keyboard.dismiss()}
              className="min-h-[44px] items-center justify-center rounded-lg bg-blue-600"
            >
              <Text className="text-base font-semibold text-white">{t("handling.ferdig")}</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {/* Handlinger */}
      <View className="gap-2 border-t border-gray-200 bg-white p-4">
        {alleSendt ? (
          <Knapp tekst={t("handling.lukk")} onPress={ikkeNaa} sekundaer />
        ) : manuell && (ikkeAnsatt || tomt) ? (
          // Ingen arbeidsdag å avslutte i manuell modus.
          <Knapp tekst={t("timer.bekreftDag.ikkeNaa")} onPress={ikkeNaa} sekundaer />
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
              deaktivert={lagrer}
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
          setRetting((r) => ({
            ...r,
            prosjektId: id ?? undefined,
            byggeplassId: undefined,
            // ORDRE 36a: skrevet beskrivelse følger med til det nye prosjektet
            // (RETUR 4: også fra arve-kortet når prosjektet hadde flere kort).
            beskrivelse: flyttBeskrivelseVedProsjektbytte(
              r.beskrivelse,
              prosjektId,
              id,
              forsteDag?.byggeplassId ?? null,
            ),
          }));
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
          setRetting((r) => {
            // ORDRE 36b: tekst på et kort som arver dagens byggeplass følger
            // med (ett kort pr. prosjekt bruker projectId-nøkkel og følger alltid).
            const fra = prosjektId
              ? kortNokkel({ projectId: prosjektId, byggeplassId: forsteDag?.byggeplassId ?? null, ecoId: null })
              : null;
            const til = prosjektId ? kortNokkel({ projectId: prosjektId, byggeplassId: id, ecoId: null }) : null;
            const b = flyttBeskrivelse(flyttBeskrivelse(r.beskrivelse, fra, til), fra, prosjektId);
            return { ...r, byggeplassId: id, beskrivelse: b };
          });
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
/** «2026-11-10» → «10.11.» */
function kortDato(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

function DatoKort({
  dag,
  visDato,
  fjernet,
  otNivaa,
  overtidValg,
  alleLonnsarter,
  rettetOvertidFra,
  tidsrunding,
  onRett,
}: {
  dag: DagsforslagDag;
  visDato: boolean;
  fjernet: boolean;
  otNivaa: Map<string, number | null>;
  overtidValg: Array<{ id: string; navn: string }>;
  alleLonnsarter: DagsforslagLonnsart[];
  rettetOvertidFra: string | undefined;
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
  const otFra = overtidEditorFra(forsteOt?.fraTid, rettetOvertidFra);
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
              (segmenterVedOvertidFra). Uten OT50 velges første nivå (leggTilOvertidRetting). */}
          {!forsteOt && overtidValg.length > 0 ? (
            <Pressable
              onPress={() => {
                onRett(leggTilOvertidRetting(fra, alleLonnsarter, overtidValg));
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
          {redigerOvertid && otFra ? (
            <View className="gap-2 rounded-md border border-amber-200 bg-white p-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">{t("timer.bekreftDag.overtidFra")}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(otFra, -1, fra, til, tidsrunding) })
                    }
                    hitSlop={8}
                    className="rounded-full border border-gray-300 p-1"
                  >
                    <Minus size={16} color="#374151" />
                  </Pressable>
                  <Text className="w-16 text-center text-sm text-gray-900">{otFra}</Text>
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(otFra, 1, fra, til, tidsrunding) })
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
                  const valgt = l.id === forsteOt?.lonnsartId;
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
