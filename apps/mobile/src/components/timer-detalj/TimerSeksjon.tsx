import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { TastaturScrollView } from "./TastaturScrollView";
import { RadHandlinger, type RadHandlingerProps } from "./prosjektkort/RadHandlinger";
// eslint-disable-next-line no-restricted-imports -- pageSheet (5 modaler i fila; ProsjektByggeplassVelgerModal direkte simulator-målt 2026-08-31): SafeAreaView anvender arkets egen topp-inset (~10 pt), X truffbar på første tapp. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Car,
  ChevronDown,
  ChevronRight,
  Split,
  Star,
  CheckSquare,
  Square,
  Calendar,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import {
  sheetTimerLocal,
  sheetMachineLocal,
  slettedeRaderLocal,
  lonnsartLocal,
  aktivitetLocal,
  equipmentLocal,
  externalCostObjectLocal,
  byggeplassLocal,
} from "../../db/schema";
import {
  finnProsjektLokalt,
  hentProsjekterLokalt,
} from "../../services/prosjektKatalog";
import {
  hentByggeplasserForProsjektLokalt,
  refreshByggeplassKatalog,
} from "../../services/byggeplassKatalog";
import { useByggeplass } from "../../kontekst/ByggeplassKontekst";
import { useNettverk } from "../../providers/NettverkProvider";
import { trpc } from "../../lib/trpc";
import {
  matpauseKontekst,
  matpauseRegelTrigget,
  radKanBaerePause,
  pauseTrukketMinForRad,
  avgjorRadPauseMin,
} from "../../services/matpause";
import { hentArbeidsdagTiderLokalt } from "../../services/kalenderKatalog";
import {
  hentStandardLonnsartLokalt,
  hentReiseLonnsartId,
  erReiseLonnsartLokalt,
  hentUnderprosjekterLokalt,
  hentLonnsarterLokalt,
} from "../../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { erReiseRadVisning } from "../../utils/reiseRad";
import { radManglerBeskrivelse } from "../../utils/dagsoversiktRader";
import { nyRadTider } from "../../utils/nyRadTider";
import type {
  TimerRad,
  Lonnsart,
  Aktivitet,
  Underprosjekt,
  Prosjekt,
} from "../../types/timer-detalj";
import {
  effektiveTimerFraSpenn,
  hhmmTilMin,
  maskinBucketKapasitet,
  pauseOverlappMin,
  tilFraAntall,
  tilErEtterFra,
  finnOverlappendeTidsrom,
  foreslaOvertidSplitt,
  type OvertidForslag,
  manuellReiseManglerArt,
} from "@sitedoc/shared";
import { ProsjektFelt } from "./ProsjektVelger";
import { FraTilTidFelt } from "./FraTilTidFelt";
import { VelgerFelt } from "./VelgerFelt";
import { forklaringTekst, useManuellReise, type ManuellReiseSpor } from "./useManuellReise";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import { EquipmentVelgerModal, EnhetVelgerModal } from "./MaskinSeksjon";
import { SplittRadModal } from "./SplittRadModal";
import { KnappMedForklaring } from "../KnappMedForklaring";
import { useKortLaas, useProsjektkortModus } from "./prosjektkortKontekst";
import {
  arvetByggeplassVisning,
  kortModusVisning,
} from "../../lib/prosjektkortMobil";
import {
  settInnTimerRad,
  type NyMaskin,
  type Radvalg,
} from "../../services/nyTimerRad";
import {
  hentKobledeMaskiner,
  maskinerOverRad,
  maskinerOverRadEtterLagring,
  skrivKobledeMaskiner,
  type MaskinEndringer,
  type MaskinLinje,
} from "../../services/kobledeMaskiner";
import { DatoVelgerFelt } from "../DatoVelgerFelt";
import { formatNorskDato } from "../../utils/dato";
import { prosjektVisningsnavn } from "../../utils/prosjektNavn";


interface TimerSeksjonProps {
  sheetId: string;
  organizationId: string;
  rader: TimerRad[];
  /** M3: ALLE timer-rader på sedelen (på tvers av alle (projectId, ECO)-bøtter),
   *  kun til overlapp-sjekken. `rader` er bøtte-scopet (prefill/visning); overlapp
   *  er kryss-bøtte (én arbeider kan ikke være to steder). Kilde: sedelens fulle
   *  rad-liste i [id].tsx, IKKE en re-flatning av bøttene. */
  alleTimerRader: TimerRad[];
  projectId: string;
  /** T7-4e (2026-05-16): ECO-filter for å pre-selektere i Add-modal og holde
   *  nye rader i samme (projectId, ECO)-bucket som parent EcoBucket. null =
   *  hovedgruppe (ingen ECO). */
  defaultEcoId?: string | null;
  /** T7-4e: skjul intern header når TimerSeksjon rendres inne i EcoBucket
   *  (ECO-subheaderen står for kontekst der). Knapp for "+Legg til timer"
   *  flyttes da til en sekundær placering. */
  visHeader?: boolean;
  /** ISO YYYY-MM-DD — dato på dagsseddelen. Brukes til kalender-utleting (T4-e). */
  dato: string;
  /** F3 (2026-07-14): sedel-nivå byggeplass (`dagsseddel_local.byggeplassId`).
   *  Vises som arvet, nedtonet verdi på rader UTEN per-rad-override
   *  (`rad.byggeplassId = null`) — kun når raden hører til sedelens primær-
   *  prosjekt (arv gjelder ikke sekundær-prosjekt-rader). */
  sedelByggeplassId: string | null;
  /** Sedel-nivå pause (min) — inngår i bucket-kapasitet for den valgfrie maskin-
   *  seksjonen på ny timer-rad (P1 maskin-i-rad, samme regel som MaskinRadModal). */
  pauseMin: number;
  /** P1 (maskin-i-rad): equipment-cache populert (Maskin-modul aktiv + firmaet
   *  har utstyr). Gater den valgfrie maskin-seksjonen på ny timer-rad. */
  harEquipmentCache: boolean;
  defaultAktivitetId: string | null;
  redigerbar: boolean;
  /** F5 (2026-07-14): sedel-nivå matpause-toggle. radId + ønsket tilstand →
   *  [id].tsx orkestrerer flytt/sett/fjern (kryss-bøtte, ekte modal, toast). */
  onPauseToggle: (radId: string, vilHa: boolean) => void;
  /** V21: dagsnorm for overtidsforslaget i rad-dialogen. Udefinert = ingen linje. */
  dagsnormTimer?: number | null;
  onEndret: () => void;
}

// ORDRE 18: dagskortets byggeplass (navn + prosjekt) til arv-visningen i
// rad-dialogen og byggeplass-velgeren.
function hentSedelByggeplass(
  id: string | null | undefined,
): { navn: string; projectId: string } | null {
  if (!id) return null;
  const db = hentDatabase();
  if (!db) return null;
  const bp = db
    .select()
    .from(byggeplassLocal)
    .where(eq(byggeplassLocal.id, id))
    .all()[0];
  return bp ? { navn: bp.navn ?? bp.id, projectId: bp.projectId } : null;
}

export function TimerSeksjon({
  sheetId,
  organizationId,
  rader,
  alleTimerRader,
  projectId,
  defaultEcoId = null,
  visHeader = true,
  dato,
  sedelByggeplassId,
  pauseMin,
  harEquipmentCache,
  defaultAktivitetId,
  redigerbar,
  onPauseToggle,
  dagsnormTimer = null,
  onEndret,
}: TimerSeksjonProps) {
  const { t } = useTranslation();
  // F5: matpause-kontekst (hvor lunsjen faller + lengde) + om regelen trigger for
  // dagen (dagsbrutto > 5,5t). Trigget beregnes fra ALLE sedelens rader
  // (`alleTimerRader`), ikke bøtte-scopet `rader` — pausen er dag-nivå.
  const { standardPauseMin } = useMemo(
    () => matpauseKontekst(organizationId, dato, alleTimerRader),
    [organizationId, dato, alleTimerRader],
  );
  const pauseRegelTrigget = useMemo(
    () => matpauseRegelTrigget(alleTimerRader, standardPauseMin),
    [alleTimerRader, standardPauseMin],
  );
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);
  // F3: kombinert prosjekt+byggeplass-velger åpnet fra rad-sekundærlinja
  // (hurtigsti). radId = raden som redigeres; separat fra full rad-modal.
  const [hurtigRadId, setHurtigRadId] = useState<string | null>(null);
  // F3: når hurtigsti-prosjektbytte ruter videre til full rad-modal, bæres det
  // nye prosjekt+byggeplass-valget hit så avhengig-felt-validering kjører der.
  const [tvungetValg, setTvungetValg] = useState<{
    projectId: string;
    byggeplassId: string | null;
  } | null>(null);
  // P2 (arbeider-splitt): raden som splittes (kun draft/returned via redigerbar).
  const [splittRadId, setSplittRadId] = useState<string | null>(null);

  const totaltimer = useMemo(
    () => rader.reduce((acc, r) => acc + r.timer, 0),
    [rader],
  );

  // Slice 3: resolver reise-lønnsart ÉN gang (samme kilde som genererForslag),
  // så reise-rader kan merkes visuelt. Sammenlignes per rad mot rad.lonnsartId.
  const reiseLonnsartId = useMemo(
    () => hentReiseLonnsartId(organizationId),
    [organizationId],
  );

  const leggTil = useCallback(
    (
      radProjectId: string,
      byggeplassId: string | null,
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
      beskrivelse: string | null,
      // V20 PK2: bærer denne raden dagens matpause? (0 ellers). Avgjort i RadSkjema
      // via `avgjorRadPauseMin` og speilet i `timer`-argumentet (= effektiveTimer
      // med DENNE pauseMin, aldri skjult firma-default). Avkrysningen viser den.
      pauseMin: number,
      maskiner: NyMaskin[],
    ) => {
      const db = hentDatabase();
      if (!db) return;
      settInnTimerRad(db, sheetId, organizationId, {
        projectId: radProjectId,
        byggeplassId,
        lonnsartId,
        aktivitetId,
        timer,
        externalCostObjectId,
        fraTid,
        tilTid,
        beskrivelse,
        pauseMin,
        maskiner,
      });
      onEndret();
    },
    [sheetId, onEndret, organizationId],
  );

  const oppdater = useCallback(
    (
      radId: string,
      radProjectId: string,
      byggeplassId: string | null,
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
      beskrivelse: string | null,
      // V20 PK2: radens matpause-bærer (0 ellers), avgjort i RadSkjema. `timer`
      // er regnet med DENNE pauseMin, så avkrysningen og timetallet stemmer.
      pauseMin: number,
      // NY BESLUTNING maskinkobling (2026-11-12): maskinlinjene fra modalen.
      //   undefined = ikke rør maskin-rader (hurtigsti: byggeplass-bytte),
      //   objekt    = endrede/nye linjer + fjernede; unevnte koblede røres ikke.
      maskiner?: MaskinEndringer,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      // B4 (L2-B): «Endrer han tiden på en utledet rad → tidKilde = manuell.»
      // Kun når fra/til FAKTISK endres — en no-op lagring skal ikke stemple en
      // auto-reise-rads "utledet" om til "manuell" (det ville vært en spor-løgn).
      const gammel = db
        .select({
          fraTid: sheetTimerLocal.fraTid,
          tilTid: sheetTimerLocal.tilTid,
          reiseKilde: sheetTimerLocal.reiseKilde,
        })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.id, radId))
        .all()[0];
      const tidEndret =
        gammel != null &&
        ((gammel.fraTid ?? null) !== (fraTid ?? null) ||
          (gammel.tilTid ?? null) !== (tilTid ?? null));
      // B4: re-utled erReise fra (ev. byttet) lønnsart. Tre tilfeller:
      //  - ikke reise  → erReise=false + RENS alt reise-spor (C2: false ⇒ spor null).
      //  - matrise-rad → behold matrise-provenance (reiseKilde/retning/km/regel i
      //    .set() urørt), bare erReise bekreftes true.
      //  - manuell reise → reiseKilde="manuell", retning/km/avstand/regel null.
      const erReise = erReiseLonnsartLokalt(organizationId, lonnsartId);
      const reiseSet = !erReise
        ? {
            erReise: false,
            reiseKilde: null,
            reiseRetning: null,
            reiseKjoretidMin: null,
            reiseAvstandM: null,
            reiseRegel: null,
          }
        : gammel?.reiseKilde === "matrise"
          ? { erReise: true as const } // behold matrise-spor
          : {
              erReise: true as const,
              reiseKilde: "manuell" as const,
              reiseRetning: null,
              reiseKjoretidMin: null,
              reiseAvstandM: null,
              reiseRegel: null,
            };
      // NY BESLUTNING maskinkobling (Kenneth 2026-11-12): maskintimer følger ALDRI
      // raden stille. Ville en koblet maskin fått flere timer enn raden, avvises
      // hele lagringen før noe skrives (rad-modalen sier fra og ber om retting).
      if (maskinerOverRadEtterLagring(db, radId, timer, maskiner).length > 0) {
        return { ok: false as const, grunn: "maskinOverRad" as const };
      }
      db.update(sheetTimerLocal)
        .set({
          projectId: radProjectId,
          // F3: per-rad byggeplass (null = arv fra dagskortet).
          byggeplassId,
          lonnsartId,
          aktivitetId,
          timer,
          externalCostObjectId,
          fraTid,
          tilTid,
          beskrivelse,
          // V20 PK2: oppdater radens matpause-bærer (avkrysningen = pauseMin > 0).
          pauseMin,
          ...reiseSet,
          ...(tidEndret ? { tidKilde: "manuell" as const } : {}),
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTimerLocal.id, radId))
        .run();
      // NY BESLUTNING: bare maskinlinjene modalen sender, skrives. Koblede maskiner
      // som ikke er nevnt, røres ikke. undefined = ingen maskin røres.
      if (maskiner !== undefined) {
        skrivKobledeMaskiner(
          db,
          sheetId,
          radId,
          { projectId: radProjectId, byggeplassId, externalCostObjectId, timer, fraTid, tilTid },
          maskiner,
        );
      }
      onEndret();
      return { ok: true as const };
    },
    [onEndret, sheetId, organizationId],
  );

  // F3 hybrid-hurtigsti: sekundærlinja åpner den kombinerte velgeren direkte.
  //  - Kun byggeplass endret (samme prosjekt): lagres direkte via `oppdater`
  //    (samme lagre-kjede som rad-modalen — ingen egen write-sti). Byggeplass-
  //    bytte rører ikke tider, så overlapp/pause-validering er upåvirket.
  //  - Prosjekt endret: kan ugyldiggjøre prosjekt-scopede felt (underprosjekt,
  //    lønnsart) → rut inn i full rad-modal med nytt prosjekt+byggeplass
  //    forhåndsvalgt, så avhengig-felt-validering kjører før lagring. Ingen
  //    stille nulling av felt.
  const handterHurtigVelg = useCallback(
    (radId: string, nyProjectId: string, nyByggeplassId: string | null) => {
      const rad = rader.find((r) => r.id === radId);
      if (!rad) {
        setHurtigRadId(null);
        return;
      }
      const gjeldendeProjectId = rad.projectId ?? projectId;
      if (nyProjectId !== gjeldendeProjectId) {
        // Prosjektbytte → full rad-modal med tvunget valg.
        setHurtigRadId(null);
        setTvungetValg({ projectId: nyProjectId, byggeplassId: nyByggeplassId });
        setRedigerRadId(radId);
        setVisModal(true);
        return;
      }
      // Samme prosjekt: no-op hvis byggeplassen er uendret (unngår unødig
      // pending-sync), ellers direkte lagring via delt lagre-kjede.
      if ((nyByggeplassId ?? null) !== (rad.byggeplassId ?? null)) {
        oppdater(
          radId,
          gjeldendeProjectId,
          nyByggeplassId,
          rad.lonnsartId,
          rad.aktivitetId,
          rad.timer,
          rad.externalCostObjectId,
          rad.fraTid,
          rad.tilTid,
          rad.beskrivelse,
          // Byggeplass-bytte rører ikke tider → bevar radens eksisterende
          // matpause-bærer (ingen re-avgjøring). maskin utelatt = ikke rør.
          rad.pauseMin,
        );
      }
      setHurtigRadId(null);
    },
    [rader, projectId, oppdater],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      // V19.9.1 (B'-3): kopier radens server_versjon inn i tombstonen FØR slettingen
      // så serveren kan klassifisere slett-vs-avvik (S1–S4). null = ukjent versjon
      // (eldre/pending rad) → S4, trygg retning (avvik slettet_telefon, ikke stille
      // sletting). Leses før tx så verdien finnes når raden er borte.
      const radForSletting = db
        .select({ serverVersjon: sheetTimerLocal.serverVersjon })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.id, radId))
        .all()[0];
      // S-A: slett lokalt + skriv tombstone ATOMISK (samme tx). Rå local-delete
      // alene propagerer ikke til server (S3 payload-id-policy) → tombstonen
      // bærer slettingen frem til neste sync.
      db.transaction((tx) => {
        tx.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, radId)).run();
        tx.insert(slettedeRaderLocal)
          .values({
            radId,
            dagsseddelId: sheetId,
            radType: "timer",
            serverVersjon: radForSletting?.serverVersjon ?? null,
            slettetVed: Date.now(),
          })
          .onConflictDoNothing()
          .run();
      });
      onEndret();
    },
    [onEndret, sheetId],
  );

  return (
    <View className={visHeader ? "mt-4" : ""}>
      {visHeader && (
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.kol.timer")} · {totaltimer.toFixed(2)} {t("timer.tEnhet")}
          </Text>
          {redigerbar && (
            <Pressable
              onPress={() => {
                setRedigerRadId(null);
                setVisModal(true);
              }}
              hitSlop={8}
              className="rounded-full bg-blue-600 p-1.5"
            >
              <Plus size={14} color="#ffffff" />
            </Pressable>
          )}
        </View>
      )}
      {rader.length === 0 ? (
        <View className="bg-white px-4 py-6">
          {redigerbar ? (
            <Pressable
              onPress={() => {
                setRedigerRadId(null);
                setVisModal(true);
              }}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Plus size={16} color="#ffffff" />
              <Text className="text-base font-semibold text-white">
                {t("timer.tilfoy.timer")}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-center text-sm text-gray-400">
              {t("timer.ingenTimerRader")}
            </Text>
          )}
        </View>
      ) : (
        rader.map((rad) => (
          <TimerRadVis
            key={rad.id}
            rad={rad}
            gruppeProjectId={projectId}
            sedelByggeplassId={sedelByggeplassId}
            erReise={erReiseRadVisning(
              // B6 (L2-B): les det EKSPLISITTE flagget (M3 — ingen gjetting fra
              // lønnsart etter lag 2). Fallback til lønnsart-match KUN for rader
              // uten flagg (se erReiseRadVisning + leveranse-funn om pull).
              rad.erReise,
              rad.lonnsartId,
              reiseLonnsartId,
            )}
            redigerbar={redigerbar}
            standardPauseMin={standardPauseMin}
            pauseRegelTrigget={pauseRegelTrigget}
            onPauseToggle={onPauseToggle}
            onRediger={() => {
              setRedigerRadId(rad.id);
              setVisModal(true);
            }}
            onByggeplassLinje={() => setHurtigRadId(rad.id)}
            onSplitt={() => setSplittRadId(rad.id)}
            onSlett={() => fjern(rad.id)}
          />
        ))
      )}

      {/* T7-4e: "+Legg til timer" når header er skjult (rendret i EcoBucket).
          Vises kun når det allerede finnes rader — tom-tilstand har sin egen
          full-bredde knapp over, så vi unngår to «legg til»-knapper samtidig. */}
      {!visHeader && redigerbar && rader.length > 0 && (
        <Pressable
          onPress={() => {
            setRedigerRadId(null);
            setVisModal(true);
          }}
          className="mt-2 flex-row items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-white py-2 active:bg-gray-50"
        >
          <Plus size={12} color="#1e40af" />
          <Text className="text-xs font-medium text-sitedoc-primary">
            {t("timer.tilfoy.timer")}
          </Text>
        </Pressable>
      )}

      {visModal && (
        <TimerRadModal
          sheetId={sheetId}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultEcoId={defaultEcoId}
          dato={dato}
          sheetPauseMin={pauseMin}
          harEquipmentCache={harEquipmentCache}
          eksisterendeRader={rader}
          alleTimerRader={alleTimerRader}
          defaultAktivitetId={defaultAktivitetId}
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          tvungetValg={tvungetValg}
          sedelByggeplassId={sedelByggeplassId}
          dagsnormTimer={dagsnormTimer}
          // V21: overtid-delen av en delt rad — ny rad, ingen maskin (den
          // koblede maskinen følger normal-delen via onLagre).
          onLeggTilOvertidDel={(
            radProjectId,
            byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
          ) =>
            leggTil(
              radProjectId,
              byggeplassId,
              lonnsartId,
              aktivitetId,
              timer,
              externalCostObjectId,
              fraTid,
              tilTid,
              beskrivelse,
              pauseMin,
              [],
            )
          }
          onLagre={(
            radProjectId,
            byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
            maskin,
          ) => {
            if (redigerRadId) {
              oppdater(
                redigerRadId,
                radProjectId,
                byggeplassId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
                // V20 PK2: radens matpause-bærer.
                pauseMin,
                // NY BESLUTNING: maskinlinjene fra modalen (unevnte røres ikke).
                maskin,
              );
            } else {
              leggTil(
                radProjectId,
                byggeplassId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
                // V20 PK2: radens matpause-bærer.
                pauseMin,
                // Ny rad: alle linjer er nye (ingen id).
                maskin.linjer,
              );
            }
            setVisModal(false);
            setRedigerRadId(null);
            setTvungetValg(null);
          }}
          onLukk={() => {
            setVisModal(false);
            setRedigerRadId(null);
            setTvungetValg(null);
          }}
        />
      )}

      {/* F3 hurtigsti: kombinert prosjekt+byggeplass-velger åpnet fra rad-
          sekundærlinja. Byggeplass-bytte lagres direkte; prosjektbytte ruter
          videre til full rad-modal (se `handterHurtigVelg`). */}
      {hurtigRadId &&
        (() => {
          const rad = rader.find((r) => r.id === hurtigRadId);
          if (!rad) return null;
          return (
            <ProsjektByggeplassVelgerModal
              organizationId={organizationId}
              valgtProjectId={rad.projectId ?? projectId}
              valgtByggeplassId={rad.byggeplassId ?? null}
              sedelByggeplassId={sedelByggeplassId}
              onVelg={(projId, byggId) =>
                handterHurtigVelg(hurtigRadId, projId, byggId)
              }
              onLukk={() => setHurtigRadId(null)}
            />
          );
        })()}

      {/* P2 (arbeider-splitt): ren lokal Drizzle-splitt av valgt rad. */}
      {splittRadId &&
        (() => {
          const rad = rader.find((r) => r.id === splittRadId);
          if (!rad) return null;
          return (
            <SplittRadModal
              radType="timer"
              original={rad}
              organizationId={organizationId}
              onLagret={() => {
                setSplittRadId(null);
                onEndret();
              }}
              onLukk={() => setSplittRadId(null)}
            />
          );
        })()}
    </View>
  );
}

function TimerRadVis({
  rad,
  gruppeProjectId,
  sedelByggeplassId,
  erReise,
  redigerbar,
  standardPauseMin,
  pauseRegelTrigget,
  onPauseToggle,
  onRediger,
  onByggeplassLinje,
  onSplitt,
  onSlett,
}: {
  rad: TimerRad;
  /** Prosjektet denne gruppa/bøtta hører til — fallback for rader uten per-rad
   *  projectId (pre-T7-3b1-data). */
  gruppeProjectId: string;
  /** F3: sedel-nivå byggeplass — arvet verdi når raden mangler override. */
  sedelByggeplassId: string | null;
  erReise: boolean;
  redigerbar: boolean;
  /** F5: pauselengde — raden må være lengre enn pausen for å kunne bære den. */
  standardPauseMin: number;
  /** F5: trigger matpause-regelen for dagen? (dagsbrutto > 5,5t). */
  pauseRegelTrigget: boolean;
  /** F5: huk matpause av/på på denne raden. */
  onPauseToggle: (radId: string, vilHa: boolean) => void;
  onRediger: () => void;
  /** F3: trykk på «Prosjekt · Byggeplass»-sekundærlinja (hurtigsti). */
  onByggeplassLinje: () => void;
  onSplitt: () => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();

  const pauseAvhuket = rad.pauseMin > 0;
  // F5: vis matpause-avhukingen (INTERAKTIV) kun når regelen trigger (dag > 5,5t)
  // OG raden er lang nok til å bære pausen (ORDRE 2026-11-13: pausen ligger der
  // summert arbeid passerer grensen, ikke i et klokkevindu). Bæreren (pauseMin > 0) er
  // avhuket; øvrige kvalifiserte rader viser en tom checkbox man kan hake for å
  // flytte pausen dit. Redigerbar-gate: kun draft/returned kan endre.
  const visPauseRad =
    redigerbar &&
    pauseRegelTrigget &&
    radKanBaerePause(rad, standardPauseMin);
  // V20 låst visning (Kenneth 2026-10-07): på en sendt/attestert/låst sedel er
  // det ingenting å flytte — men bæreren skal VISE at pausen er trukket,
  // skrivebeskyttet. Kun bæreren (ikke tom avkrysning): speiler web (dagsseddel +
  // attestering), som også bare viser den honnøre påstanden.
  const visPauseRadLaast = !redigerbar && pauseAvhuket;
  // F5 (fabel edge #1): etiketten viser de FAKTISK trukne minuttene for raden
  // (spenn-overlapp mot lunsjvinduet gitt radens pauseMin) — ikke hardkodet 30.
  // Full-spenn → 30 min; delvis overlapp → f.eks. 15 min. Kun visning; rører
  // ikke pause-beregningen. visPauseRad garanterer fra/til er satt.
  // ORDRE 2026-11-13: utledet av lagret timer (spenn − timer), så gamle
  // vindu-rader med delvis overlapp vises som de ble lagret.
  const pauseTrukketMin = pauseTrukketMinForRad(rad);

  // F3: radens effektive prosjekt (per-rad override eller gruppe-fallback).
  const effektivProjectId = rad.projectId ?? gruppeProjectId;
  const prosjektNavn = useMemo(
    () => finnProsjektLokalt(effektivProjectId)?.name ?? null,
    [effektivProjectId],
  );

  // F3: byggeplass-visning på sekundærlinja. Override (`rad.byggeplassId`) i
  // vanlig styrke; ellers arv fra dagskortet (`sedelByggeplassId`) nedtonet —
  // men kun når den arvede byggeplassen faktisk hører til radens prosjekt (arv
  // gjelder sedelens primærprosjekt; sekundær-prosjekt-rader arver ikke).
  const byggeplassInfo = useMemo(() => {
    const arvet = rad.byggeplassId == null;
    const effektivId = rad.byggeplassId ?? sedelByggeplassId;
    if (!effektivId) return null;
    const db = hentDatabase();
    if (!db) return null;
    const bp = db
      .select()
      .from(byggeplassLocal)
      .where(eq(byggeplassLocal.id, effektivId))
      .all()[0];
    if (!bp) return null;
    if (arvet && bp.projectId !== effektivProjectId) return null;
    return { navn: bp.navn ?? null, arvet };
  }, [rad.byggeplassId, sedelByggeplassId, effektivProjectId]);

  const lonnsart = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.id, rad.lonnsartId))
      .all()[0];
    return treff ?? null;
  }, [rad.lonnsartId]);

  const aktivitet = useMemo(() => {
    if (!rad.aktivitetId) return null;
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.id, rad.aktivitetId))
      .all()[0];
    return treff ?? null;
  }, [rad.aktivitetId]);

  return (
    <View className="border-b border-gray-100 bg-white">
      <View className="flex-row items-center gap-2 px-4 pb-1.5 pt-3">
      <View className="flex-1">
        {erReise ? (
          // Slice 3: reise-rad merkes distinkt (🚗 + «Reisetid») så den skiller
          // seg fra arbeidstid-radene i prosjektgruppen.
          <View className="flex-row items-center gap-1.5">
            <Car size={15} color="#1e40af" />
            <Text className="text-base font-medium text-sitedoc-primary">
              {t("timer.reisetid")}
            </Text>
          </View>
        ) : (
          <Text className="text-base text-gray-900">
            {lonnsart?.navn ?? rad.lonnsartId}
          </Text>
        )}
        <View className="flex-row flex-wrap gap-2">
          {aktivitet && (
            <Text className="text-xs text-gray-500">{aktivitet.navn}</Text>
          )}
          {lonnsart?.kode && (
            <Text className="text-xs text-gray-500">{lonnsart.kode}</Text>
          )}
          {rad.fraTid && rad.tilTid && (
            <Text className="text-xs text-gray-500">
              {rad.fraTid}–{rad.tilTid}
            </Text>
          )}
          {rad.externalCostObjectId && (
            <UnderprosjektEtikett ecoId={rad.externalCostObjectId} />
          )}
        </View>
        {/* T.12: fritekst-beskrivelse av hva som ble gjort */}
        {rad.beskrivelse && (
          <View className="mt-1 flex-row items-start gap-1">
            <Pencil size={12} color="#9ca3af" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs italic text-gray-600">
              {rad.beskrivelse}
            </Text>
          </View>
        )}
      </View>
      <Text className="font-mono text-base text-gray-900">
        {rad.timer.toFixed(2)}
      </Text>
      {redigerbar && (
        <View className="flex-row gap-1">
          <Pressable
            onPress={onRediger}
            hitSlop={8}
            className="rounded p-1.5 active:bg-gray-100"
          >
            <Pencil size={16} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={onSplitt}
            hitSlop={8}
            className="rounded p-1.5 active:bg-gray-100"
          >
            <Split size={16} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={onSlett}
            hitSlop={8}
            className="rounded p-1.5 active:bg-red-50"
          >
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}
      </View>

      {/* F3: sekundærlinje «Prosjekt · Byggeplass». Hele linja er trykkflate
          (≥44px) → åpner den kombinerte prosjekt+byggeplass-velgeren direkte
          (hurtigsti). Ingen egen «endre»-knapp. Override i vanlig tekststyrke;
          arvet byggeplass nedtonet med «fra dagskortet»-hint. */}
      {redigerbar ? (
        <Pressable
          onPress={onByggeplassLinje}
          className="min-h-[44px] flex-row items-center gap-1 px-4 pb-2 active:bg-gray-50"
        >
          <ByggeplassLinjeTekst
            prosjektNavn={prosjektNavn ?? effektivProjectId}
            byggeplassInfo={byggeplassInfo}
          />
          <ChevronRight size={16} color="#9ca3af" />
        </Pressable>
      ) : (
        <View className="min-h-[44px] flex-row items-center gap-1 px-4 pb-2">
          <ByggeplassLinjeTekst
            prosjektNavn={prosjektNavn ?? effektivProjectId}
            byggeplassInfo={byggeplassInfo}
          />
        </View>
      )}

      {/* F5: kompakt matpause-avhuking nederst på det trigrede rad-kortet. Kun
          synlig når dag > 5,5t OG raden krysser lunsjvinduet. Bæreren er avhuket;
          å hake av flytter pausen (flytt-ikke-radio, orkestreres i [id].tsx). */}
      {visPauseRad && (
        <Pressable
          onPress={() => onPauseToggle(rad.id, !pauseAvhuket)}
          className="min-h-[40px] flex-row items-center gap-2 border-t border-gray-100 px-4 py-2 active:bg-gray-50"
        >
          {pauseAvhuket ? (
            <CheckSquare size={18} color="#1e40af" />
          ) : (
            <Square size={18} color="#9ca3af" />
          )}
          <Text
            className={`text-xs ${pauseAvhuket ? "text-gray-700" : "text-gray-400"}`}
          >
            {pauseAvhuket
              ? t("timer.matpause.trukket", { min: pauseTrukketMin })
              : t("timer.matpause.trukketUmerket")}
          </Text>
        </Pressable>
      )}

      {/* V20 låst visning: bæreren skrivebeskyttet (ingen Pressable, ingen flytt). */}
      {visPauseRadLaast && (
        <View className="min-h-[40px] flex-row items-center gap-2 border-t border-gray-100 px-4 py-2">
          <CheckSquare size={18} color="#1e40af" />
          <Text className="text-xs text-gray-700">
            {t("timer.matpause.trukket", { min: pauseTrukketMin })}
          </Text>
        </View>
      )}
    </View>
  );
}

/** F3: felles render av «Prosjekt · Byggeplass»-sekundærlinja (grå, ~12px). */
function ByggeplassLinjeTekst({
  prosjektNavn,
  byggeplassInfo,
}: {
  prosjektNavn: string;
  byggeplassInfo: { navn: string | null; arvet: boolean } | null;
}) {
  const { t } = useTranslation();
  const kortVisning = kortModusVisning(useProsjektkortModus());
  return (
    <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
      {prosjektNavn}
      {" · "}
      {byggeplassInfo ? (
        <Text
          className={byggeplassInfo.arvet ? "text-gray-400" : "text-gray-600"}
        >
          {byggeplassInfo.navn ?? t("byggeplassVelger.velg")}
          {byggeplassInfo.arvet
            ? ` (${t(kortVisning.fra)})`
            : ""}
        </Text>
      ) : (
        <Text className="text-gray-400">{t("timer.byggeplass.ingenValgt")}</Text>
      )}
    </Text>
  );
}

function UnderprosjektEtikett({ ecoId }: { ecoId: string }) {
  const eco = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, ecoId))
        .all()[0] ?? null
    );
  }, [ecoId]);
  if (!eco) return null;
  return (
    <Text className="text-xs font-medium text-blue-700">
      {eco.proAdmId} {eco.kortNavn}
    </Text>
  );
}

/**
 * «+» rett til timer-raden (ORDRE 17): modalen åpnes uten sedel. Wrapperen
 * (`NyTimerRadFlyt`) eier dato + sendt-sjekk; sedelen opprettes først ved Lagre.
 */
export interface TimerRadOpprettelse {
  onDatoEndret: (dato: string) => void;
  /** Sedel-id når datoen er sendt/akseptert — skjemaet sperres, «Åpne dagen» vises. */
  laastDagId: string | null;
  onAapneDagen: (sheetId: string) => void;
  /** Sist brukt / firma-standard for prosjektet (`sistBrukteRadvalg`). */
  radvalgFor: (projectId: string) => Radvalg;
}

function isoDato(d: Date): string {
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${maaned}-${dag}`;
}

/** Én maskinlinje i rad-modalen (tekstfelt som strenger). id null = ny. */
type MaskinLinjeSkjema = {
  noekkel: string;
  id: string | null;
  vehicleId: string;
  timer: string;
  mengde: string;
  enhet: string;
};

export function TimerRadModal({
  sheetId,
  organizationId,
  defaultProjectId,
  defaultByggeplassId,
  defaultEcoId,
  dato,
  sheetPauseMin,
  harEquipmentCache,
  eksisterendeRader,
  alleTimerRader,
  defaultAktivitetId,
  eksisterendeRad,
  tvungetValg,
  sedelByggeplassId,
  opprettelse,
  handlinger,
  fokusBeskrivelse = false,
  reise,
  dagsnormTimer,
  onLeggTilOvertidDel,
  onLagre,
  onLukk,
}: {
  /** Tom streng i opprettelsesmodus når datoen ikke har sedel ennå. */
  sheetId: string;
  organizationId: string;
  defaultProjectId: string;
  /** ORDRE 29: byggeplass en NY rad starter på (innlogget/GPS). Ignoreres for
   *  eksisterende rad og ved `tvungetValg`. */
  defaultByggeplassId?: string | null;
  defaultEcoId: string | null;
  dato: string;
  /** Sedel-nivå pause (min) — bucket-kapasitet i den valgfrie maskin-seksjonen.
   *  Skilt fra den lokale `pauseMin` (firma standardPauseMin) som styrer fra/til-
   *  synken; kapasitets-taket bruker sedel-pausen (D6), speiler MaskinRadModal. */
  sheetPauseMin: number;
  /** P1 (maskin-i-rad): gater den valgfrie maskin-seksjonen (kun ved ny rad). */
  harEquipmentCache: boolean;
  eksisterendeRader: TimerRad[];
  alleTimerRader: TimerRad[];
  defaultAktivitetId: string | null;
  eksisterendeRad: TimerRad | null;
  /** F3 hurtigsti-ruting: prosjektbytte fra rad-sekundærlinja forhåndsvelger
   *  nytt prosjekt (+ byggeplass) her, så avhengig-felt-validering (underprosjekt,
   *  lønnsart) kjører i full modal. null = vanlig åpning (rad/default styrer). */
  tvungetValg: { projectId: string; byggeplassId: string | null } | null;
  /** Fabel D: dagskortets byggeplass — videreført til byggeplass-velgeren for
   *  «· arves fra dagskortet»-markering. Ren visning. */
  sedelByggeplassId: string | null;
  /** Satt = opprettelsesmodus fra «+» (datofelt øverst, prosjekt byttbart). */
  opprettelse?: TimerRadOpprettelse;
  /** ORDRE 36b: «Del opp»/«Slett» — kun fra prosjektkort-flyten. Udefinert
   *  (dagskortet) = ingen knapper, modalen som før. */
  handlinger?: RadHandlingerProps;
  /** ORDRE 36b: dagsoversiktens «Beskrivelse»/«Mangler» åpner med fokus i
   *  beskrivelsesfeltet. Standard false = som før. */
  fokusBeskrivelse?: boolean;
  /** ORDRE 36b: reise fra dag-seksjonen. Ny rad starter på reise-lønnsarten;
   *  byggeplass/underprosjekt vises kun når valgt prosjekt har flere
   *  byggeplasser / underprosjekter (K3), ellers lagres null.
   *  Udefinert (dagskortet, kortene) = som før. */
  reise?: { lonnsartId: string | null; laast?: boolean };
  /** V21: dagsnorm for overtidsforslaget. Udefinert/null (kortene, ny-rad-flyten)
   *  = ingen forslagslinje, modalen som før. */
  dagsnormTimer?: number | null;
  /** V21: lagrer overtid-delen som ny rad når forslaget deler raden. Normal-
   *  delen går gjennom `onLagre`. Udefinert = kun «hel rad»-forslag vises ikke
   *  heller (forslagslinja krever begge). */
  onLeggTilOvertidDel?: (
    projectId: string,
    byggeplassId: string | null,
    lonnsartId: string,
    aktivitetId: string,
    timer: number,
    externalCostObjectId: string | null,
    fraTid: string,
    tilTid: string,
    beskrivelse: string | null,
    pauseMin: number,
  ) => void;
  onLagre: (
    projectId: string,
    byggeplassId: string | null,
    lonnsartId: string,
    aktivitetId: string,
    timer: number,
    externalCostObjectId: string | null,
    fraTid: string | null,
    tilTid: string | null,
    beskrivelse: string | null,
    // V20 PK2: radens matpause-bærer (0 ellers).
    pauseMin: number,
    // NY BESLUTNING: maskinlinjene (nye uten id) + fjernede koblede maskiner.
    maskiner: MaskinEndringer,
    // Ordre (9): terskel/bånd-sporet for en NY «+ Reise»-rad. Udefinert ellers
    // (og når regelsettet ikke er synket) — kalleren lagrer da som før.
    reiseSpor?: ManuellReiseSpor,
  ) => void;
  onLukk: () => void;
}) {
  const { t, i18n } = useTranslation();
  // V21: timetall i forslagslinja i brukerens språk (7,5 / 7.5).
  const formaterTimer = (n: number) =>
    n.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const kortModus = useProsjektkortModus();
  const kortVisning = kortModusVisning(kortModus);
  // T.5 + pause-synk: hent firma-innstillinger fra lokal cache.
  //   - tidsrundingMinutter: null = ingen runding
  //   - pauseMin: matpausens lengde (standardPauseMin, default 30), brukt til
  //     pause-bevisst auto-synk antall ↔ fra/til. Pausepunktet pr. rad kommer
  //     fra `matpauseKontekst` (ORDRE 2026-11-13, etter grensen i arbeidstimer).
  const { tidsrundingMinutter, pauseMin } = useMemo(() => {
    const setting = hentOrganizationSettingLokalt(organizationId);
    return {
      tidsrundingMinutter: setting?.tidsrundingMinutter ?? null,
      pauseMin: setting?.standardPauseMin ?? 30,
    };
  }, [organizationId]);

  // ORDRE 2026-11-13: pausepunktet pr. rad via delt `matpauseKontekst` — der
  // summert arbeid (dagens andre rader + denne) passerer firmaets grense.
  const pauseKontekst = useMemo(
    () => matpauseKontekst(organizationId, dato, alleTimerRader),
    [organizationId, dato, alleTimerRader],
  );
  const pauseFraFor = useCallback(
    (fra: string, til: string): string =>
      pauseKontekst.pauseFraFor({ id: eksisterendeRad?.id ?? null, fraTid: fra, tilTid: til }),
    [pauseKontekst, eksisterendeRad],
  );

  // V20 PK2: radens EGEN matpause (0 eller standardPauseMin) for de oppgitte
  // tidene — bæreren bestemmes mot alle sedelens rader (kun-én-pr.-dag). Brukes i
  // både timer-synken og lagringen så timetallet, avkrysningen og det lagrede
  // fradraget alltid stemmer — ingen skjult firma-default lenger (P1). Kalles med
  // de FERSKE tidene i hver handler (unngår en-render-lag mot `radPauseMin`-memo).
  // ORDRE 36c del B: en reiserad bærer aldri matpausen. Boolsk i dep-arrayene
  // — `reise`-objektet er nytt hver render hos kalleren.
  const erReiseRad = !!reise;
  const radPauseMinFor = useCallback(
    (fra: string | null, til: string | null): number =>
      erReiseRad
        ? 0
        : avgjorRadPauseMin({
            alleRader: alleTimerRader,
            radId: eksisterendeRad?.id ?? null,
            fraTid: fra,
            tilTid: til,
            standardPauseMin: pauseMin,
            pauseEtterTimer: pauseKontekst.pauseEtterTimer,
            fastPauseFra: pauseKontekst.fastPauseFra,
          }),
    [erReiseRad, alleTimerRader, eksisterendeRad, pauseKontekst, pauseMin],
  );

  // Beregn defaults for fraTid/tilTid ved opprettelse av ny rad.
  //   - Ny rad: fraTid = SENESTE tilTid på HELE sedelen (M6 bolk (g) prefill-
  //     scope), ellers effektiv.startTid; tilTid = effektiv.sluttTid
  //   - Rediger eksisterende rad: bruk radens egne verdier
  const defaultTider = useMemo(() => {
    if (eksisterendeRad) {
      return {
        fra: eksisterendeRad.fraTid ?? null,
        til: eksisterendeRad.tilTid ?? null,
      };
    }
    const effektiv = hentArbeidsdagTiderLokalt(organizationId, new Date(`${dato}T00:00:00`));
    // Bolk (g) prefill-scope (M6, 2026-07-10): fra = seneste tilTid over HELE
    // sedelen (alle bøtter, `alleTimerRader`) — speiler webs reduce i
    // `page.tsx` `onTilfoyTimer`. `eksisterendeRader` (bøtte-scopet) beholdes
    // for lønnsart/aktivitet-prefill (`defaultValg`). Reise: ingen sluttid.
    return nyRadTider({
      reise: erReiseRad,
      tilTider: alleTimerRader.map((r) => r.tilTid),
      effektiv,
    });
  }, [eksisterendeRad, alleTimerRader, organizationId, dato, erReiseRad]);

  // Forhåndsvelg lønnsart + aktivitet på ny rad. Prioritetskjede:
  //   - Rediger eksisterende rad: bruk radens egne verdier
  //   - Ny rad med eksisterende rader: forrige rads lønnsart/aktivitet (Variant A)
  //   - Ny rad på tom sedel: firma-default lønnsart (Variant B, erStandardvalg)
  //     → tom hvis ingen er markert. Aktivitet faller til sedelens default.
  const defaultValg = useMemo(() => {
    if (eksisterendeRad) {
      return {
        lonnsartId: eksisterendeRad.lonnsartId,
        aktivitetId: eksisterendeRad.aktivitetId,
      };
    }
    if (opprettelse) {
      const valg = opprettelse.radvalgFor(defaultProjectId);
      return { lonnsartId: valg.lonnsartId ?? "", aktivitetId: valg.aktivitetId ?? "" };
    }
    const sisteRad =
      eksisterendeRader.length > 0
        ? eksisterendeRader[eksisterendeRader.length - 1]
        : null;
    const firmaDefaultLonnsartId =
      hentStandardLonnsartLokalt(organizationId)?.id ?? "";
    if (reise?.lonnsartId) {
      return {
        lonnsartId: reise.lonnsartId,
        aktivitetId: sisteRad?.aktivitetId ?? defaultAktivitetId ?? "",
      };
    }
    return {
      lonnsartId: sisteRad?.lonnsartId ?? firmaDefaultLonnsartId,
      aktivitetId: sisteRad?.aktivitetId ?? defaultAktivitetId ?? "",
    };
    // opprettelse leses kun ved åpning (initialverdi); prosjektbytte håndteres i onVelg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eksisterendeRad, eksisterendeRader, defaultAktivitetId, organizationId]);

  // F3: tvungetValg (hurtigsti-prosjektbytte) vinner over radens/defaults ved
  // init — så full modal åpner med det nye prosjektet forhåndsvalgt.
  const [valgtProjectId, setValgtProjectId] = useState<string>(
    tvungetValg?.projectId ?? eksisterendeRad?.projectId ?? defaultProjectId,
  );
  // ORDRE 36b K3: reise viser byggeplass/underprosjekt bare når relevant.
  const reiseVisByggeplass =
    !!reise && hentByggeplasserForProsjektLokalt(valgtProjectId).length > 1;
  const reiseVisUnderprosjekt =
    !!reise && hentUnderprosjekterLokalt(valgtProjectId).length > 0;
  // F3: per-rad byggeplass. null = arv fra dagskortet (sedel-nivå). Byggeplass
  // hører alltid til rad-prosjektet; nullstilles ved prosjektbytte i modalen.
  // ORDRE 29: ny rad fra «+» starter på innlogget byggeplass (`defaultByggeplassId`).
  // ORDRE 36b: på et kort er byggeplass låst til kortets (effektive) valg.
  const kortLaas = useKortLaas();
  const [valgtByggeplassId, setValgtByggeplassId] = useState<string | null>(
    kortLaas
      ? kortLaas.byggeplassId
      : tvungetValg
      ? tvungetValg.byggeplassId
      : eksisterendeRad
        ? eksisterendeRad.byggeplassId ?? null
        : defaultByggeplassId ?? null,
  );
  const [valgtLonnsartId, setValgtLonnsartId] = useState<string>(
    defaultValg.lonnsartId,
  );
  const [valgtAktivitetId, setValgtAktivitetId] = useState<string>(
    defaultValg.aktivitetId,
  );
  // B3-prefill-gyldighet (M6): begge tider satt og fra < til. Speiler webs
  // `prefillGyldig` i TimerRadDialog. Er spennet ugyldig (f.eks. seneste tilTid
  // ≥ skiftslutt), forhåndsutfylles verken til eller antall — ingen 0-/fra>til-rad.
  const prefillGyldig =
    !!defaultTider.fra &&
    !!defaultTider.til &&
    hhmmTilMin(defaultTider.fra) < hhmmTilMin(defaultTider.til);
  const [timer, setTimer] = useState<string>(() => {
    if (eksisterendeRad?.timer) return eksisterendeRad.timer.toFixed(2);
    // B3 (M6): init antall fra prefill-spennet (pause-bevisst) — kun ved gyldig
    // prefill. Pausen er radens egen (`radPauseMinFor`, PK1), aldri firma-default.
    if (prefillGyldig) {
      return effektiveTimerFraSpenn(
        defaultTider.fra!,
        defaultTider.til!,
        pauseFraFor(defaultTider.fra!, defaultTider.til!),
        // V20 PK2: radens egen pause, ikke firma-default (P1 skjult fradrag).
        radPauseMinFor(defaultTider.fra, defaultTider.til),
      ).toFixed(2);
    }
    return "";
  });
  // T7-4e: defaultEcoId pre-selekteres når bruker klikker "+Legg til timer"
  // i en spesifikk ECO-bucket. Ved redigering brukes radens egen ECO.
  // F3: ved tvungetValg (prosjektbytte) nullstilles ECO — den er prosjekt-
  // spesifikk og radens gamle ECO gjelder ikke det nye prosjektet.
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    kortLaas
      ? kortLaas.ecoId
      : tvungetValg ? null : eksisterendeRad?.externalCostObjectId ?? defaultEcoId,
  );
  const [fraTid, setFraTid] = useState<string | null>(defaultTider.fra);
  // Bolk (g)/web-speiling: til prefylles kun ved gyldig prefill (fra < til).
  const [tilTid, setTilTid] = useState<string | null>(
    prefillGyldig ? defaultTider.til : null,
  );
  const [beskrivelse, setBeskrivelse] = useState<string>(
    eksisterendeRad?.beskrivelse ?? "",
  );
  // Ordre (9): terskel og avstandsbånd på NY «+ Reise»-rad — delt regel
  // (`klassifiserManuellReise`). Under terskel → standard ordinær art, erReise
  // false; over → båndets art (kjent avstand) eller resolverens.
  const manuellReiseAktiv = !!reise?.laast && !eksisterendeRad;
  const manuellReise = useManuellReise({
    aktiv: manuellReiseAktiv,
    organizationId,
    byggeplassId: valgtByggeplassId ?? sedelByggeplassId,
    timer: (() => {
      const n = parseFloat(timer.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    })(),
    resolverLonnsartId: reise?.lonnsartId ?? null,
  });
  const manuellKlassifisering = manuellReise.klassifisering;
  const manuellLonnsartId = manuellKlassifisering
    ? (manuellKlassifisering.lonnsartId ?? "")
    : null;
  useEffect(() => {
    if (manuellLonnsartId != null) setValgtLonnsartId(manuellLonnsartId);
  }, [manuellLonnsartId]);
  // Under terskel er raden arbeidstid: teller i overtid som annen arbeid.
  const manuellUnderTerskel = !!manuellReise.spor && !manuellReise.spor.erReise;
  const [beskrivelseFeil, setBeskrivelseFeil] = useState(false);
  const beskrivelseRef = useRef<TextInput>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [visDatoVelger, setVisDatoVelger] = useState(false);
  // Opprettelse: ny dato → fra/til/antall forhåndsutfylles på nytt mot den
  // datoens arbeidsdag og rader. Prosjekt, lønnsart og aktivitet beholdes.
  const [prefillDato, setPrefillDato] = useState(dato);
  if (opprettelse && prefillDato !== dato) {
    setPrefillDato(dato);
    setFraTid(defaultTider.fra);
    setTilTid(prefillGyldig ? defaultTider.til : null);
    setTimer(
      prefillGyldig
        ? effektiveTimerFraSpenn(
            defaultTider.fra!,
            defaultTider.til!,
            pauseFraFor(defaultTider.fra!, defaultTider.til!),
            radPauseMinFor(defaultTider.fra, defaultTider.til),
          ).toFixed(2)
        : "",
    );
  }
  // F3: kombinert prosjekt+byggeplass-velger (erstatter ren prosjekt-velger her).
  const [visProsjektByggeplassVelger, setVisProsjektByggeplassVelger] =
    useState(false);
  const [visLonnsartVelger, setVisLonnsartVelger] = useState(false);
  const [visAktivitetVelger, setVisAktivitetVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);
  // NY BESLUTNING maskinkobling (Kenneth 2026-11-12): raden har 0..n koblede
  // maskiner (sheetTimerId = radens id), hver med EGNE timer (standard =
  // radens, aldri flere). Modalen viser ALLE koblede maskiner som linjer; bare
  // linjer som endres, skrives. Før: kun første koblede maskin (`.all()[0]`)
  // ble vist, og den fikk alltid radens timer ved lagring.
  const kobledeMaskiner = useMemo(() => {
    if (!eksisterendeRad) return [];
    const db = hentDatabase();
    if (!db) return [];
    return hentKobledeMaskiner(db, eksisterendeRad.id);
  }, [eksisterendeRad]);
  // Del B pkt 1 / DoD «≤ 2 trykk fra raden»: ved REDIGERING auto-utvides
  // seksjonen (finnes cache). Ny rad forblir kollapset (valgfritt).
  const [visMaskin, setVisMaskin] = useState(
    kobledeMaskiner.length > 0 || (!!eksisterendeRad && harEquipmentCache),
  );
  const [maskinLinjer, setMaskinLinjer] = useState<MaskinLinjeSkjema[]>(() =>
    kobledeMaskiner.map((m) => ({
      noekkel: m.id,
      id: m.id,
      vehicleId: m.vehicleId,
      timer: String(m.timer),
      mengde: m.mengde != null ? String(m.mengde) : "",
      enhet: m.enhet ?? "",
    })),
  );
  const [fjernedeMaskinIds, setFjernedeMaskinIds] = useState<string[]>([]);
  // Indeksen til linja utstyrs-/enhetsvelgeren er åpnet for (null = lukket).
  const [maskinUtstyrFor, setMaskinUtstyrFor] = useState<number | null>(null);
  const [maskinEnhetFor, setMaskinEnhetFor] = useState<number | null>(null);
  const endreMaskinLinje = (i: number, endring: Partial<MaskinLinjeSkjema>) =>
    setMaskinLinjer((ls) => ls.map((l, k) => (k === i ? { ...l, ...endring } : l)));

  // Full auto-synk (pause-bevisst). Sist-rørte felt vinner:
  //   - endrer fra/til → antall beregnes (spenn − pauseoverlapp)
  //   - skriver antall → til beregnes (fra + antall, lunsj skjøvet inn)
  // Ingen loop: hver handler setter det/de ANDRE feltene direkte (ikke via
  // samme onChange).
  const handterFraEndret = useCallback(
    (hhmm: string) => {
      setFraTid(hhmm);
      if (tilTid) {
        setTimer(
          effektiveTimerFraSpenn(
            hhmm,
            tilTid,
            pauseFraFor(hhmm, tilTid),
            radPauseMinFor(hhmm, tilTid),
          ).toFixed(2),
        );
      }
    },
    [tilTid, pauseFraFor, radPauseMinFor],
  );

  const handterTilEndret = useCallback(
    (hhmm: string) => {
      setTilTid(hhmm);
      if (fraTid) {
        setTimer(
          effektiveTimerFraSpenn(
            fraTid,
            hhmm,
            pauseFraFor(fraTid, hhmm),
            radPauseMinFor(fraTid, hhmm),
          ).toFixed(2),
        );
      }
    },
    [fraTid, pauseFraFor, radPauseMinFor],
  );

  const handterTimerEndret = useCallback(
    (tekst: string) => {
      setTimer(tekst);
      const n = parseFloat(tekst.replace(",", "."));
      if (fraTid && !isNaN(n) && n > 0 && n <= 24) {
        // Antall → til: bruk radens pause for GJELDENDE tider (til beregnes her,
        // så bæreren avgjøres mot det nåværende spennet; lagrings-guarden regner
        // uansett om med de ferske tidene).
        // ORDRE 2026-11-13: bærerens pause ligger alltid HELT inne i raden, så
        // til = fra + antall + pause (pausepunkt = fra gir nettopp det).
        setTilTid(tilFraAntall(fraTid, n, fraTid, radPauseMinFor(fraTid, tilTid)));
      }
    },
    [fraTid, tilTid, radPauseMinFor],
  );

  // Transparens: hvor mange minutter pause raden faktisk absorberer (0 = ingen).
  const pauseOverlapp = useMemo(() => {
    if (!fraTid || !tilTid) return 0;
    const fm = hhmmTilMin(fraTid);
    const tm = hhmmTilMin(tilTid);
    if (tm <= fm) return 0;
    // V20 PK2: vis bare fradrag når raden FAKTISK bærer pausen (0 ellers).
    return pauseOverlappMin(
      fm,
      tm,
      hhmmTilMin(pauseFraFor(fraTid, tilTid)),
      radPauseMinFor(fraTid, tilTid),
    );
  }, [fraTid, tilTid, pauseFraFor, radPauseMinFor]);

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

  // F3: navn på valgt byggeplass (til felt-visning). null = arv fra dagskortet.
  const valgtByggeplassNavn = useMemo(() => {
    if (!valgtByggeplassId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, valgtByggeplassId))
        .all()[0]?.navn ?? null
    );
  }, [valgtByggeplassId]);

  // ORDRE 18: arv vises som dagskortets faktiske byggeplass, ikke «Arv fra …».
  const arvetByggeplass = useMemo(
    () =>
      arvetByggeplassVisning(
        hentSedelByggeplass(sedelByggeplassId),
        valgtProjectId,
        kortModus,
      ),
    [sedelByggeplassId, valgtProjectId, kortModus],
  );

  const valgtLonnsart = useMemo(() => {
    if (!valgtLonnsartId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(lonnsartLocal)
        .where(eq(lonnsartLocal.id, valgtLonnsartId))
        .all()[0] ?? null
    );
  }, [valgtLonnsartId]);

  const valgtAktivitet = useMemo(() => {
    if (!valgtAktivitetId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(aktivitetLocal)
        .where(eq(aktivitetLocal.id, valgtAktivitetId))
        .all()[0] ?? null
    );
  }, [valgtAktivitetId]);

  const valgtEco = useMemo(() => {
    if (!valgtEcoId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, valgtEcoId))
        .all()[0] ?? null
    );
  }, [valgtEcoId]);

  // Utstyret for hver maskinlinje (VelgerFelt-visning).
  const maskinUtstyr = useMemo(() => {
    const db = hentDatabase();
    const kart = new Map<string, typeof equipmentLocal.$inferSelect>();
    if (!db) return kart;
    for (const l of maskinLinjer) {
      if (!l.vehicleId || kart.has(l.vehicleId)) continue;
      const e = db.select().from(equipmentLocal).where(eq(equipmentLocal.id, l.vehicleId)).all()[0];
      if (e) kart.set(l.vehicleId, e);
    }
    return kart;
  }, [maskinLinjer]);
  const utstyrNavn = (vehicleId: string) => {
    const e = maskinUtstyr.get(vehicleId);
    return e ? `${e.merke ?? ""} ${e.modell ?? ""}`.trim() || e.internNavn || null : null;
  };

  // P1: maskiner allerede brukt på seddelen — løftes øverst i utstyrsvelgeren
  // (samme Del 1-mønster som MaskinRadModal).
  const bruktVehicleIds = useMemo(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all()
      .map((r) => r.vehicleId);
  }, [sheetId]);

  // P1 (maskin-i-rad): proaktiv bucket-kapasitet for maskin-seksjonen. «Så langt»-
  // visning: arbeidSum + eksisterende maskin i (valgtProjectId, valgtEcoId), ledig
  // via delt @sitedoc/shared-regel. Sedel-pausen (`sheetPauseMin`) er kapasitets-
  // taket (D6) — IKKE den lokale `pauseMin` (firma standardPauseMin, fra/til-synk).
  const maskinKapasitet = useMemo(() => {
    const db = hentDatabase();
    if (!db) return { arbeidSum: 0, sumMaskin: 0, ledig: 0 };
    const iBucket = (r: {
      projectId: string | null;
      externalCostObjectId: string | null;
    }) =>
      (r.projectId ?? defaultProjectId) === valgtProjectId &&
      (r.externalCostObjectId ?? null) === (valgtEcoId ?? null);
    // Ordre (6): maskin måles mot arbeid UTEN reise.
    const reiseArtId = hentReiseLonnsartId(organizationId);
    const arbeidSum = db
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all()
      .filter((r) => iBucket(r) && !erReiseRadVisning(r.erReise, r.lonnsartId, reiseArtId))
      .reduce((acc, r) => acc + (r.timer ?? 0), 0);
    const sumMaskin = db
      .select()
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all()
      .filter(iBucket)
      .reduce((acc, r) => acc + (r.timer ?? 0), 0);
    const { ledig } = maskinBucketKapasitet({
      arbeidSum,
      sumMaskinEksisterende: sumMaskin,
      pauseMin: sheetPauseMin,
    });
    return { arbeidSum, sumMaskin, ledig };
  }, [sheetId, valgtProjectId, valgtEcoId, sheetPauseMin, defaultProjectId, organizationId]);

  // Speiler web-TimerRadDialogs disabled-logikk: kjernefeltene + fra/til
  // obligatorisk på timer-rader (2026-07-13, reverserer a2). Validering i lagre()
  // beholdes (viser konkret feilmelding); dette er UI-hintet.
  const dagLaast = !!opprettelse?.laastDagId;

  // V21: overtidsforslag for denne raden — sedelens øvrige rader + dialogens
  // gjeldende verdier, delt regel (`foreslaOvertidSplitt`). Kun et forslag;
  // ingenting skrives før knappen trykkes.
  const overtidForslag = useMemo(() => {
    if (dagsnormTimer == null || !onLeggTilOvertidDel) return null;
    if (!fraTid || !tilTid || !valgtLonnsartId) return null;
    const katalog = hentLonnsarterLokalt(organizationId);
    const nivaaFor = (id: string | null) =>
      katalog.find((l) => l.id === id)?.overtidsnivaa ?? null;
    const egenId = eksisterendeRad?.id ?? "__ny__";
    const rader = [
      ...alleTimerRader
        .filter((r) => r.id !== eksisterendeRad?.id)
        .map((r) => ({
          id: r.id,
          fraTid: r.fraTid ?? null,
          tilTid: r.tilTid ?? null,
          pauseMin: r.pauseMin ?? 0,
          erReise: !!r.erReise,
          overtidsnivaa: nivaaFor(r.lonnsartId),
        })),
      {
        id: egenId,
        fraTid,
        tilTid,
        pauseMin: radPauseMinFor(fraTid, tilTid),
        erReise:
          (erReiseRad && !manuellUnderTerskel) ||
          erReiseLonnsartLokalt(organizationId, valgtLonnsartId),
        overtidsnivaa: nivaaFor(valgtLonnsartId),
      },
    ];
    return (
      foreslaOvertidSplitt(rader, dagsnormTimer, katalog, {
        pauseFra: (r) =>
          r.fraTid && r.tilTid
            ? pauseKontekst.pauseFraFor({ id: r.id, fraTid: r.fraTid, tilTid: r.tilTid })
            : "00:00",
      }).find(
        (f) => f.radId === egenId,
      ) ?? null
    );
  }, [
    dagsnormTimer,
    onLeggTilOvertidDel,
    fraTid,
    tilTid,
    valgtLonnsartId,
    organizationId,
    eksisterendeRad?.id,
    alleTimerRader,
    radPauseMinFor,
    erReiseRad,
    pauseKontekst,
    manuellUnderTerskel,
  ]);

  const kanLagre =
    !dagLaast &&
    !!valgtProjectId &&
    !!valgtLonnsartId &&
    !!valgtAktivitetId &&
    !!timer.trim() &&
    !!fraTid &&
    !!tilTid;

  function lagre(forslag?: OvertidForslag<Lonnsart>) {
    setFeil(null);
    if (dagLaast) return;
    if (!valgtProjectId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtLonnsartId) {
      // Ordre (11) C: «+ Reise» uten art å føre på (firmaet mangler standard
      // lønnsart) — si hvorfor i stedet for «velg lønnsart» i et låst felt.
      setFeil(
        t(
          manuellReiseManglerArt(manuellKlassifisering)
            ? "timer.reiseTerskel.manglerArt"
            : "timer.feil.lonnsartPaakrevd",
        ),
      );
      return;
    }
    if (!valgtAktivitetId) {
      setFeil(t("timer.feil.aktivitetPaakrevd"));
      return;
    }
    // Kenneth 2026-11-12: arbeidsrad krever beskrivelse (reise unntatt).
    // Feltmelding under beskrivelsesfeltet; ingenting lagres.
    if (
      radManglerBeskrivelse(
        beskrivelse,
        erReiseRad || erReiseLonnsartLokalt(organizationId, valgtLonnsartId),
      )
    ) {
      setBeskrivelseFeil(true);
      beskrivelseRef.current?.focus();
      return;
    }
    // Fra/til obligatorisk på timer-rader (2026-07-13) — reverserer a2. Tid-løse
    // rader er ufullstendige lønnsdata + usynlige for overlapp-vakten.
    if (!fraTid || !tilTid) {
      setFeil(t("timer.feil.fraTilPaakrevd"));
      return;
    }
    const tall = parseFloat(timer.replace(",", "."));
    if (isNaN(tall) || tall <= 0 || tall > 24) {
      setFeil(t("timer.feil.ugyldigTimer"));
      return;
    }
    // T4-e: fraTid < tilTid hvis begge er satt. Null tolereres. Delt regel
    // (@sitedoc/shared) — samme som server-vakten (SYNC-2).
    if (!tilErEtterFra(fraTid, tilTid)) {
      setFeil(t("timer.feil.sluttForStart"));
      return;
    }
    // M3: overlapp-speiling — stopp arbeideren lokalt før lagring i stedet for
    // etter server-avvisning (SYNC-2). Kryss-bøtte: sjekk mot ALLE timer-rader på
    // sedelen (`alleTimerRader`, ikke bøtte-scopet `eksisterendeRader`), på tvers
    // av (projectId, ECO) — «én arbeider kan ikke være to steder». Ekskluderer
    // raden som redigeres på tvers av hele sedelen (pre-eksisterende overlapp
    // låser derfor ikke arbeideren ute — han kan åpne og rette den).
    if (fraTid && tilTid) {
      const andreRader = alleTimerRader.filter(
        (r) => r.id !== eksisterendeRad?.id,
      );
      const overlapp = finnOverlappendeTidsrom(fraTid, tilTid, andreRader);
      if (overlapp) {
        setFeil(
          t("timer.feil.overlapp", {
            fra: fraTid,
            til: tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
          }),
        );
        return;
      }
    }
    // Pause-synk: når begge tider er satt MÅ antall stemme med (spenn − pause).
    // Auto-synken holder dem i takt; dette er sikkerhetsnettet mot manuell
    // desync (fjerner dagens stille avvik-bug).
    // V20 PK2: avgjør radens egen matpause-bærer for de ENDELIGE tidene — guarden
    // og lagringen bruker samme verdi, så timetall, avkrysning og fradrag stemmer.
    const radPauseMin = radPauseMinFor(fraTid, tilTid);
    if (fraTid && tilTid) {
      const forventet = effektiveTimerFraSpenn(
        fraTid,
        tilTid,
        pauseFraFor(fraTid, tilTid),
        radPauseMin,
      );
      if (Math.abs(forventet - tall) > 0.01) {
        setFeil(t("timer.feil.timerAvvik", { forventet: forventet.toFixed(2) }));
        return;
      }
    }
    // NY BESLUTNING maskinkobling: hver maskinlinje har egne timer ≤ radens
    // lagrede timer (ved V21-splitt: normal-delens). Over → feilmelding, ingen
    // lagring, ingen automatisk retting. Linje uten utstyr ignoreres.
    const radTimerLagret = forslag?.normal && onLeggTilOvertidDel ? forslag.normal.timer : tall;
    const tilTall = (v: string) => parseFloat(v.replace(",", "."));
    const linjer: MaskinLinje[] = [];
    for (const l of maskinLinjer) {
      if (!l.vehicleId) continue;
      const mt = tilTall(l.timer);
      if (isNaN(mt) || mt <= 0) {
        setFeil(t("timer.feil.ugyldigTimer"));
        return;
      }
      const mengdeNum = l.mengde.trim() ? tilTall(l.mengde) : NaN;
      linjer.push({
        id: l.id,
        vehicleId: l.vehicleId,
        timer: mt,
        mengde: isNaN(mengdeNum) ? null : mengdeNum,
        enhet: l.enhet || null,
      });
    }
    const over = maskinerOverRad(radTimerLagret, linjer)[0];
    if (over) {
      setFeil(
        t("timer.maskinSeksjon.overRad", {
          maskin: utstyrNavn(over.vehicleId) ?? t("timer.maskinSeksjon.merke"),
          maskinTimer: formaterTimer(over.timer),
          radTimer: formaterTimer(radTimerLagret),
        }),
      );
      return;
    }
    const maskin: MaskinEndringer = { linjer, fjernede: fjernedeMaskinIds };
    // V21: overtidsforslaget. Hel rad over normen → samme lagring med overtid-
    // lønnsarten. Krysser normen → normal-delen via onLagre (beholder id, maskin
    // og lønnsart), overtid-delen som ny rad via onLeggTilOvertidDel.
    if (forslag?.normal && onLeggTilOvertidDel) {
      onLagre(
        valgtProjectId,
        valgtByggeplassId,
        valgtLonnsartId,
        valgtAktivitetId,
        forslag.normal.timer,
        valgtEcoId,
        forslag.normal.fraTid,
        forslag.normal.tilTid,
        beskrivelse.trim() || null,
        forslag.normal.pauseMin,
        maskin,
        manuellReise.spor ?? undefined,
      );
      onLeggTilOvertidDel(
        valgtProjectId,
        valgtByggeplassId,
        forslag.overtidLonnsart.id,
        valgtAktivitetId,
        forslag.overtid.timer,
        valgtEcoId,
        forslag.overtid.fraTid,
        forslag.overtid.tilTid,
        beskrivelse.trim() || null,
        forslag.overtid.pauseMin,
      );
      return;
    }
    onLagre(
      valgtProjectId,
      valgtByggeplassId,
      forslag ? forslag.overtidLonnsart.id : valgtLonnsartId,
      valgtAktivitetId,
      tall,
      valgtEcoId,
      fraTid,
      tilTid,
      beskrivelse.trim() || null,
      // V20 PK2: radens matpause-bærer (0 ellers).
      radPauseMin,
      maskin,
      manuellReise.spor ?? undefined,
    );
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {eksisterendeRad ? t("timer.rediger.timer") : t("timer.tilfoy.timer")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <TastaturScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
        >
          {opprettelse && (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">
                {t("timer.felt.dato")}
              </Text>
              <Pressable
                onPress={() => setVisDatoVelger((v) => !v)}
                className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Calendar size={18} color="#6b7280" />
                  <Text className="text-base text-gray-900">{formatNorskDato(dato)}</Text>
                </View>
                <ChevronRight size={18} color="#9ca3af" />
              </Pressable>
              {visDatoVelger && (
                <DatoVelgerFelt
                  value={new Date(`${dato}T00:00:00`)}
                  mode="date"
                  iosDisplay="inline"
                  onChange={(_, valgt) => {
                    if (Platform.OS !== "ios") setVisDatoVelger(false); // Android lukker selv
                    if (valgt) opprettelse.onDatoEndret(isoDato(valgt));
                  }}
                  onLukk={() => setVisDatoVelger(false)}
                />
              )}
            </View>
          )}

          {/* Q7: sendt/akseptert dag tar ikke nye rader — vis hvorfor + vei dit. */}
          {opprettelse?.laastDagId && (
            <View className="gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm text-amber-900">{t("timer.dagSendt")}</Text>
              <Pressable
                onPress={() => opprettelse.onAapneDagen(opprettelse.laastDagId!)}
                className="items-center rounded-lg border border-amber-300 bg-white px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-amber-900">
                  {t("timer.aapneDagen")}
                </Text>
              </Pressable>
            </View>
          )}

          {!dagLaast && (
          <>
          {/* F3: kombinert prosjekt+byggeplass. Feltet åpner én velger der
              begge velges (byggeplass innenfor valgt prosjekt). Byggeplass er
              valgfri (null = arv fra dagskortet, server propagerer sedel-verdi). */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.prosjekt")} *
            </Text>
            <ProsjektFelt
              prosjektNavn={valgtProsjekt?.name ?? null}
              onTrykk={() => setVisProsjektByggeplassVelger(true)}
              laast={kortVisning.prosjektLaast}
            />
            {(!reise || reiseVisByggeplass || !!valgtByggeplassId) && (
            <Pressable
              onPress={() => setVisProsjektByggeplassVelger(true)}
              disabled={!!kortLaas}
              accessibilityState={{ disabled: !!kortLaas }}
              className="mt-1 flex-row items-center gap-1 px-1 py-0.5"
            >
              <Text className="text-xs text-gray-500">
                {t("timer.felt.byggeplass")}:{" "}
              </Text>
              <Text
                className={
                  valgtByggeplassId && !kortLaas
                    ? "flex-1 text-xs text-gray-700"
                    : "flex-1 text-xs text-gray-400"
                }
                numberOfLines={1}
              >
                {valgtByggeplassId
                  ? (valgtByggeplassNavn ?? t("byggeplassVelger.velg"))
                  : arvetByggeplass.navn
                    ? `${arvetByggeplass.navn} (${t(arvetByggeplass.nokkel)})`
                    : t(arvetByggeplass.nokkel)}
              </Text>
            </Pressable>
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.lonnsart")} *
            </Text>
            {/* Ordre (6): «+ Reise» låser lønnsarten til den løste
                reise-arten på NY rad (eksisterende rad redigeres som før). */}
            {reise?.laast && !eksisterendeRad ? (
              <View>
                <Text className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  {valgtLonnsart?.navn ?? ""}
                </Text>
                {/* Ordre (9): grå forklaring på hvorfor raden ble arbeid/reise. */}
                {/* Ordre (11) C: mangler art → tydelig rød tekst, ikke grå. */}
                {manuellKlassifisering && (
                  <Text
                    className={`mt-1 text-xs ${
                      manuellReiseManglerArt(manuellKlassifisering)
                        ? "font-medium text-red-700"
                        : "text-gray-500"
                    }`}
                  >
                    {manuellReiseManglerArt(manuellKlassifisering)
                      ? t("timer.reiseTerskel.manglerArt")
                      : forklaringTekst(
                          t,
                          manuellKlassifisering,
                          manuellReise.lonnsartNavn(manuellKlassifisering.lonnsartId),
                        )}
                  </Text>
                )}
                {manuellReise.velger && (
                  <OppmotestedVelger
                    tittel={t("timer.reiseTerskel.fraOppmotested")}
                    placeholder={t("timer.reiseTerskel.velgOppmotested")}
                    {...manuellReise.velger}
                  />
                )}
              </View>
            ) : (
              <VelgerFelt
                verdi={valgtLonnsart?.navn ?? null}
                placeholder={t("timer.velgLonnsart")}
                onPress={() => setVisLonnsartVelger(true)}
              />
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.aktivitet")} *
            </Text>
            <VelgerFelt
              verdi={valgtAktivitet?.navn ?? null}
              placeholder={t("timer.velgAktivitet")}
              onPress={() => setVisAktivitetVelger(true)}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.antallTimer")} *
            </Text>
            <TextInput
              value={timer}
              onChangeText={handterTimerEndret}
              placeholder="0,00"
              keyboardType="decimal-pad"
              inputAccessoryViewID={TASTATUR_FERDIG_ID}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          {/* T4-e: Fra-/til-tid per rad. Forhåndsutfylling fra kalender +
              forrige rads tilTid. T.5: avrunding via firma-setting.
              Pause-synk: fra/til ↔ antall holdes i takt, pause-bevisst. */}
          <View>
            <FraTilTidFelt
              fraTid={fraTid}
              tilTid={tilTid}
              tidsrundingMinutter={tidsrundingMinutter}
              onFraEndret={handterFraEndret}
              onTilEndret={handterTilEndret}
              paakrevd
            />
            {pauseOverlapp > 0 && (
              <Text className="mt-1 text-xs text-gray-500">
                {t("timer.pauseFradrag", { min: pauseOverlapp })}
              </Text>
            )}
          </View>

          {/* V21: overtidsforslag — én linje, én knapp. Vises kun når raden
              (eller dagen) passerer dagsnormen og firmaet har overtid-lønnsart. */}
          {overtidForslag && (
            <View className="gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm text-amber-900">
                {overtidForslag.normal
                  ? t("timer.overtidForslag.splitt", {
                      over: formaterTimer(overtidForslag.overTimer),
                      normalNavn: valgtLonnsart?.navn ?? "",
                      nFra: overtidForslag.normal.fraTid,
                      nTil: overtidForslag.normal.tilTid,
                      otNavn: overtidForslag.overtidLonnsart.navn,
                      oFra: overtidForslag.overtid.fraTid,
                      oTil: overtidForslag.overtid.tilTid,
                    })
                  : t("timer.overtidForslag.helRad", {
                      over: formaterTimer(overtidForslag.overTimer),
                      otNavn: overtidForslag.overtidLonnsart.navn,
                    })}
              </Text>
              <Pressable
                onPress={() => lagre(overtidForslag)}
                className="items-center rounded-lg border border-amber-300 bg-white px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-amber-900">
                  {overtidForslag.normal
                    ? t("timer.overtidForslag.delKnapp")
                    : t("timer.overtidForslag.helKnapp")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Underprosjekt (valgfritt) — Tilleggsarbeid, Endring m.fl. */}
          {(!reise || reiseVisUnderprosjekt || !!valgtEcoId) && (
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}
            </Text>
            <VelgerFelt
              verdi={
                valgtEco ? `${valgtEco.proAdmId} — ${valgtEco.kortNavn}` : null
              }
              placeholder={t("timer.velgUnderprosjekt")}
              onPress={() => setVisEcoVelger(true)}
              onClear={() => setValgtEcoId(null)}
              laast={!!kortLaas}
            />
          </View>
          )}

          {/* T.12: fritekst per rad — «hva gjorde du?». Påkrevd på arbeidsrad
              (Kenneth 2026-11-12), reise unntatt. */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.radBeskrivelse")}
            </Text>
            <TextInput
              ref={beskrivelseRef}
              value={beskrivelse}
              onChangeText={(v) => {
                setBeskrivelse(v);
                if (beskrivelseFeil && v.trim()) setBeskrivelseFeil(false);
              }}
              autoFocus={fokusBeskrivelse}
              placeholder={t("timer.radBeskrivelsePlaceholder")}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`min-h-[72px] rounded-lg border bg-white px-3 py-3 text-base text-gray-900 ${beskrivelseFeil ? "border-red-500" : "border-gray-300"}`}
            />
            {beskrivelseFeil && (
              <Text className="mt-1 text-sm text-red-600">
                {t("timer.feil.beskrivelsePaakrevd")}
              </Text>
            )}
          </View>

          {/* P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon, også ved
              redigering (≤ 2 trykk). NY BESLUTNING maskinkobling (Kenneth
              2026-11-12): én linje pr. koblet maskin med egne timer — standard
              radens timer, aldri flere (lagre() avviser). Krever populert
              equipment-cache; tom cache viser en forklarende nedtonet rad. */}
          {harEquipmentCache && (
            <View className="rounded-lg border border-gray-200 bg-gray-50">
              <Pressable
                onPress={() => setVisMaskin((v) => !v)}
                className="flex-row items-center justify-between px-3 py-2.5"
              >
                <View className="flex-row items-center gap-2">
                  <View className="rounded bg-slate-100 px-1.5 py-0.5">
                    <Text className="text-[10px] font-semibold uppercase text-slate-600">
                      {t("timer.maskinSeksjon.merke")}
                    </Text>
                  </View>
                  <Text className="text-sm font-medium text-gray-700">
                    {t("timer.maskinSeksjon.tittel")}
                  </Text>
                </View>
                <ChevronDown
                  size={18}
                  color="#9ca3af"
                  style={{
                    transform: [{ rotate: visMaskin ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>
              {visMaskin && (
                <View className="gap-3 border-t border-gray-200 p-3">
                  {/* NY BESLUTNING maskinkobling: én linje pr. maskin med
                      egne timer (standard radens, aldri flere). */}
                  {maskinLinjer.map((l, i) => (
                    <View key={l.noekkel} className="gap-2 rounded-lg border border-gray-200 bg-white p-2">
                      <View className="flex-row items-center gap-2">
                        <View className="flex-1">
                          <VelgerFelt
                            verdi={l.vehicleId ? utstyrNavn(l.vehicleId) : null}
                            placeholder={t("timer.velgUtstyr")}
                            onPress={() => setMaskinUtstyrFor(i)}
                            underTekst={
                              maskinUtstyr.get(l.vehicleId)?.internNummer
                                ? `#${maskinUtstyr.get(l.vehicleId)!.internNummer}`
                                : null
                            }
                          />
                        </View>
                        <Pressable
                          onPress={() => {
                            if (l.id) setFjernedeMaskinIds((f) => [...f, l.id!]);
                            setMaskinLinjer((ls) => ls.filter((_, k) => k !== i));
                          }}
                          hitSlop={8}
                          accessibilityLabel={t("timer.maskinSeksjon.fjern")}
                        >
                          <Trash2 size={18} color="#dc2626" />
                        </Pressable>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-gray-500">
                            {t("timer.maskinSeksjon.timer")}
                          </Text>
                          <TextInput
                            value={l.timer}
                            onChangeText={(v) => endreMaskinLinje(i, { timer: v })}
                            placeholder="0,00"
                            keyboardType="decimal-pad"
                            inputAccessoryViewID={TASTATUR_FERDIG_ID}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-gray-500">
                            {t("timer.felt.mengde")}
                          </Text>
                          <TextInput
                            value={l.mengde}
                            onChangeText={(v) => endreMaskinLinje(i, { mengde: v })}
                            placeholder="0,00"
                            keyboardType="decimal-pad"
                            inputAccessoryViewID={TASTATUR_FERDIG_ID}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-gray-500">
                            {t("timer.felt.enhet")}
                          </Text>
                          <VelgerFelt
                            verdi={l.enhet || null}
                            placeholder={t("timer.felt.enhet")}
                            onPress={() => setMaskinEnhetFor(i)}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      // Standard = radens timer slik den står nå i skjemaet.
                      setMaskinLinjer((ls) => [
                        ...ls,
                        { noekkel: `ny-${Date.now()}-${ls.length}`, id: null, vehicleId: "", timer: timer, mengde: "", enhet: "" },
                      ]);
                      setMaskinUtstyrFor(maskinLinjer.length);
                    }}
                    className="flex-row items-center gap-1.5 self-start rounded-lg border border-gray-300 bg-white px-3 py-2"
                  >
                    <Plus size={14} color="#374151" />
                    <Text className="text-sm font-medium text-gray-700">
                      {t("timer.maskinSeksjon.leggTil")}
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-gray-500">
                    {t("timer.maskinSeksjon.kapasitet", {
                      arbeid: maskinKapasitet.arbeidSum.toFixed(2),
                      maskin: maskinKapasitet.sumMaskin.toFixed(2),
                      ledig: Math.max(0, maskinKapasitet.ledig).toFixed(2),
                    })}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {t("timer.maskinSeksjon.hint")}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Del B pkt 1: tom equipment-cache → forklarende nedtonet rad i stedet
              for stille skjuling (device-funn #4). Ingen usynlig funksjon; sier
              hvorfor maskin ikke kan legges til akkurat nå. */}
          {!harEquipmentCache && (
            <View className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <View className="flex-row items-center gap-2">
                <View className="rounded bg-slate-100 px-1.5 py-0.5">
                  <Text className="text-[10px] font-semibold uppercase text-slate-400">
                    {t("timer.maskinSeksjon.merke")}
                  </Text>
                </View>
                <Text className="flex-1 text-xs text-gray-400">
                  {t("timer.maskinSeksjon.ingenTilgjengelig")}
                </Text>
              </View>
            </View>
          )}

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <KnappMedForklaring sperret={!kanLagre} forklaring={t("sperret.timerRad")}>
            <Pressable
              onPress={() => lagre()}
              disabled={!kanLagre}
              className={`mt-4 items-center rounded-lg px-6 py-4 ${
                kanLagre ? "bg-blue-600 active:bg-blue-700" : "bg-blue-300"
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {t("handling.lagre")}
              </Text>
            </Pressable>
          </KnappMedForklaring>
          {handlinger && <RadHandlinger handlinger={handlinger} />}
          </>
          )}
        </TastaturScrollView>
        <TastaturFerdig />

        {visLonnsartVelger && (
          <LonnsartVelgerModal
            valgtId={valgtLonnsartId}
            onVelg={(id) => {
              setValgtLonnsartId(id);
              setVisLonnsartVelger(false);
            }}
            onLukk={() => setVisLonnsartVelger(false)}
          />
        )}

        {visAktivitetVelger && (
          <AktivitetVelgerModal
            valgtId={valgtAktivitetId}
            onVelg={(id) => {
              setValgtAktivitetId(id);
              setVisAktivitetVelger(false);
            }}
            onLukk={() => setVisAktivitetVelger(false)}
          />
        )}

        {visEcoVelger && (
          <UnderprosjektVelgerModal
            projectId={valgtProjectId}
            valgtId={valgtEcoId}
            onVelg={(id) => {
              setValgtEcoId(id);
              setVisEcoVelger(false);
            }}
            onLukk={() => setVisEcoVelger(false)}
          />
        )}

        {visProsjektByggeplassVelger && (
          <ProsjektByggeplassVelgerModal
            organizationId={organizationId}
            valgtProjectId={valgtProjectId}
            valgtByggeplassId={valgtByggeplassId}
            sedelByggeplassId={sedelByggeplassId}
            onVelg={(projId, byggId) => {
              if (projId !== valgtProjectId) {
                setValgtProjectId(projId);
                // Nullstill ECO ved prosjekt-bytte — ECO er prosjekt-spesifikk.
                setValgtEcoId(null);
                // Opprettelse: lønnsart/aktivitet følger prosjektets sist brukte.
                if (opprettelse) {
                  const valg = opprettelse.radvalgFor(projId);
                  if (valg.lonnsartId) setValgtLonnsartId(valg.lonnsartId);
                  if (valg.aktivitetId) setValgtAktivitetId(valg.aktivitetId);
                }
              }
              setValgtByggeplassId(byggId);
              setVisProsjektByggeplassVelger(false);
            }}
            onLukk={() => setVisProsjektByggeplassVelger(false)}
          />
        )}

        {/* P1 (maskin-i-rad): gjenbrukte velgere fra MaskinSeksjon for den
            valgfrie maskin-seksjonen (utstyr + enhet). */}
        {maskinUtstyrFor !== null && (
          <EquipmentVelgerModal
            organizationId={organizationId}
            valgtId={maskinLinjer[maskinUtstyrFor]?.vehicleId ?? ""}
            brukt={bruktVehicleIds}
            onVelg={(id) => {
              endreMaskinLinje(maskinUtstyrFor, { vehicleId: id });
              setMaskinUtstyrFor(null);
            }}
            onLukk={() => setMaskinUtstyrFor(null)}
          />
        )}

        {maskinEnhetFor !== null && (
          <EnhetVelgerModal
            valgt={maskinLinjer[maskinEnhetFor]?.enhet ?? ""}
            onVelg={(v) => {
              endreMaskinLinje(maskinEnhetFor, { enhet: v });
              setMaskinEnhetFor(null);
            }}
            onLukk={() => setMaskinEnhetFor(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// P2 (arbeider-splitt): eksportert for gjenbruk i SplittRadModal (samme
// lønnsart-velger som TimerRadModal).
export function LonnsartVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const lonnsarter = useMemo<Lonnsart[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return lonnsarter;
    const q = sok.toLowerCase();
    return lonnsarter.filter(
      (l) =>
        l.navn.toLowerCase().includes(q) ||
        (l.kode ?? "").toLowerCase().includes(q),
    );
  }, [lonnsarter, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgLonnsart")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {lonnsarter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                <Text className="text-xs text-gray-500">
                  {[item.kode, item.type].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenLonnsarter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// P2 (arbeider-splitt): eksportert for gjenbruk i SplittRadModal (samme
// aktivitet-velger som TimerRadModal).
export function AktivitetVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const aktiviteter = useMemo<Aktivitet[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return aktiviteter;
    const q = sok.toLowerCase();
    return aktiviteter.filter(
      (a) =>
        a.navn.toLowerCase().includes(q) ||
        (a.kode ?? "").toLowerCase().includes(q),
    );
  }, [aktiviteter, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgAktivitet")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {aktiviteter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                {item.kode && (
                  <Text className="text-xs text-gray-500">{item.kode}</Text>
                )}
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenAktiviteter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// T7-4e (2026-05-16): eksportert for gjenbruk i MaskinSeksjon (ECO-velger
// for maskin-rader, samme mønster som timer-rader).
export function UnderprosjektVelgerModal({
  projectId,
  valgtId,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const ecoer = useMemo<Underprosjekt[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(externalCostObjectLocal)
      .where(
        and(
          eq(externalCostObjectLocal.projectId, projectId),
          eq(externalCostObjectLocal.status, "aktiv"),
          eq(externalCostObjectLocal.timerregistreringApen, true),
        ),
      )
      .all();
  }, [projectId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return ecoer;
    const q = sok.toLowerCase();
    return ecoer.filter(
      (e) =>
        e.proAdmId.toLowerCase().includes(q) ||
        e.kortNavn.toLowerCase().includes(q),
    );
  }, [ecoer, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgUnderprosjekt")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {ecoer.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">
                  {item.proAdmId}
                </Text>
                <Text className="text-sm text-gray-600">{item.kortNavn}</Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenUnderprosjekter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

/**
 * F3 (2026-07-14): kombinert prosjekt+byggeplass-velger for timer-rad-modalen +
 * rad-sekundærlinjas hurtigsti. Én pageSheet: øverst en prosjekt-rad (trykk
 * ekspanderer prosjektlista inline), under byggeplass-lista filtrert på valgt
 * prosjekt. Prosjektbytte oppdaterer lista på stedet (ikke to-stegs wizard).
 * Byggeplass er valgfri: «Arv fra dagskortet» velger null (sedel-nivå propagering).
 *
 * Gjenbruker ByggeplassVelgers list-logikk: F2s tri-tilstand tom-visning +
 * auto-refresh (tom cache + online), søkefelt-terskel (>7). Sortering:
 * favoritter → resten. INGEN GPS-tier — GPS-kontekst lever kun på sedel-nivå
 * («Start dag»); rad-modalen har ingen GPS-kontekst → `gpsForeslagId` utelates.
 */
export function ProsjektByggeplassVelgerModal({
  organizationId,
  valgtProjectId,
  valgtByggeplassId,
  sedelByggeplassId,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  valgtProjectId: string;
  valgtByggeplassId: string | null;
  /** Fabel D: dagskortets (sedel-nivå) byggeplass — markerer HVILKEN konkrete
   *  byggeplass «Arv fra dagskortet» faktisk peker på. null = dagskortet har
   *  ingen byggeplass satt (ingen rad markeres). Ren visning. */
  sedelByggeplassId?: string | null;
  /** byggeplassId = null → «Arv fra dagskortet» (sedel-nivå propagering). */
  onVelg: (projectId: string, byggeplassId: string | null) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  // Prosjektkort L2: kortets prosjekt er låst — kun byggeplass kan velges.
  const kortModus = useProsjektkortModus();
  const kortVisning = kortModusVisning(kortModus);
  const { favorittIder, toggleFavoritt } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();

  const [lokaltProjectId, setLokaltProjectId] = useState(valgtProjectId);
  const [visProsjektListe, setVisProsjektListe] = useState(false);
  const [prosjektSok, setProsjektSok] = useState("");
  const [sok, setSok] = useState("");
  // F2 tri-tilstand: skill «henter» / «offline» / «bekreftet tomt».
  const [laster, setLaster] = useState(false);
  const [refreshFullført, setRefreshFullført] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const prosjekter = useMemo<Prosjekt[]>(() => {
    if (!organizationId) return [];
    return hentProsjekterLokalt(organizationId);
  }, [organizationId]);

  // ORDRE 18: første valg viser byggeplassen raden faktisk arver.
  const arvetByggeplass = useMemo(
    () =>
      arvetByggeplassVisning(
        hentSedelByggeplass(sedelByggeplassId),
        lokaltProjectId,
        kortModus,
      ),
    [sedelByggeplassId, lokaltProjectId, kortModus],
  );

  const filtrerteProsjekter = useMemo(() => {
    if (!prosjektSok.trim()) return prosjekter;
    const q = prosjektSok.toLowerCase();
    return prosjekter.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.projectNumber ?? "").toLowerCase().includes(q),
    );
  }, [prosjekter, prosjektSok]);

  const valgtProsjekt = useMemo(
    () => finnProsjektLokalt(lokaltProjectId),
    [lokaltProjectId],
  );

  const byggeplasser = useMemo(() => {
    if (!lokaltProjectId) return [];
    return hentByggeplasserForProsjektLokalt(lokaltProjectId);
    // refreshNonce tvinger re-lesing etter at et byggeplass-refresh fullførte.
  }, [lokaltProjectId, refreshNonce]);

  // Reset-catch (fabels F3-catch): inline prosjektbytte endrer `lokaltProjectId`
  // uten remount → nullstill refresh-tilstand + søk, ellers ville et nytt
  // prosjekt vist «bekreftet tomt» basert på FORRIGE prosjekts fullførte refresh.
  // Den eksisterende ByggeplassVelger dekker ikke dette nye komponentet.
  useEffect(() => {
    setLaster(false);
    setRefreshFullført(false);
    setSok("");
  }, [lokaltProjectId]);

  // F2: tom cache + online → hent byggeplasser ved åpning/prosjektbytte.
  // «Bekreftet tomt» (tilstand 3) vises kun ETTER at et refresh har fullført
  // tomt — aldri før.
  useEffect(() => {
    if (
      !lokaltProjectId ||
      byggeplasser.length > 0 ||
      !erPaaNettet ||
      laster ||
      refreshFullført
    ) {
      return;
    }
    const orgId =
      finnProsjektLokalt(lokaltProjectId)?.organizationId ?? organizationId;
    if (!orgId) return;
    let avbrutt = false;
    setLaster(true);
    refreshByggeplassKatalog(utils.client, orgId)
      .catch(() => {
        // Feil svelges (samme som TimerSyncProvider) — faller tilbake til
        // «bekreftet tomt»/eksisterende cache; ikke kritisk sti.
      })
      .finally(() => {
        if (avbrutt) return;
        setLaster(false);
        setRefreshFullført(true);
        setRefreshNonce((n) => n + 1);
      });
    return () => {
      avbrutt = true;
    };
  }, [
    lokaltProjectId,
    byggeplasser.length,
    erPaaNettet,
    laster,
    refreshFullført,
    organizationId,
    utils.client,
  ]);

  const filtrerteByggeplasser = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const treff = q
      ? byggeplasser.filter(
          (b) =>
            (b.navn ?? "").toLowerCase().includes(q) ||
            String(b.number ?? "").includes(q),
        )
      : byggeplasser;
    // Sortering: favoritter → resten (stabil innen hver gruppe). Ingen GPS-tier
    // i rad-velgeren — GPS lever kun på sedel-nivå.
    const rang = (id: string) => (favorittIder.includes(id) ? 0 : 1);
    return [...treff].sort((a, b) => rang(a.id) - rang(b.id));
  }, [byggeplasser, sok, favorittIder]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgProsjektByggeplass")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        {/* Prosjekt-rad — trykk ekspanderer prosjektlista inline. */}
        <Pressable
          onPress={() => setVisProsjektListe((v) => !v)}
          disabled={kortVisning.prosjektLaast}
          className="flex-row items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3"
        >
          <View className="flex-1">
            <Text className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t("timer.felt.prosjekt")}
            </Text>
            <Text className="text-base text-gray-900">
              {prosjektVisningsnavn(valgtProsjekt, t("timer.detalj.ukjentProsjekt"))}
            </Text>
          </View>
          {!kortVisning.prosjektLaast && (
            <ChevronDown
              size={20}
              color="#6b7280"
              style={{
                transform: [{ rotate: visProsjektListe ? "180deg" : "0deg" }],
              }}
            />
          )}
        </Pressable>

        {visProsjektListe ? (
          <>
            {prosjekter.length > 7 && (
              <View className="border-b border-gray-200 px-4 py-2">
                <TextInput
                  value={prosjektSok}
                  onChangeText={setProsjektSok}
                  placeholder={t("handling.sok")}
                  className="rounded bg-gray-100 px-3 py-2 text-base"
                />
              </View>
            )}
            <FlatList
              data={filtrerteProsjekter}
              keyExtractor={(item) => item.id}
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (item.id !== lokaltProjectId) {
                      setLokaltProjectId(item.id);
                    }
                    setVisProsjektListe(false);
                    setProsjektSok("");
                  }}
                  className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                    item.id === lokaltProjectId ? "bg-blue-50" : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-base text-gray-900">{item.name}</Text>
                  </View>
                  {item.id === lokaltProjectId && (
                    <Check size={18} color="#1e40af" />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("timer.ingenTilgjengelige")}
                  </Text>
                </View>
              )}
            />
          </>
        ) : (
          <>
            {/* «Arv fra dagskortet» (byggeplass = null → sedel-nivå propagering). */}
            <Pressable
              onPress={() => onVelg(lokaltProjectId, null)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                valgtByggeplassId == null ? "bg-blue-50" : ""
              }`}
            >
              <Text className="flex-1 text-base text-gray-700">
                {arvetByggeplass.navn ?? t(arvetByggeplass.nokkel)}
                {arvetByggeplass.navn != null && (
                  <Text className="text-gray-400">
                    {` (${t(arvetByggeplass.nokkel)})`}
                  </Text>
                )}
              </Text>
              {valgtByggeplassId == null && <Check size={18} color="#1e40af" />}
            </Pressable>
            {byggeplasser.length > 7 && (
              <View className="border-b border-gray-200 px-4 py-2">
                <TextInput
                  value={sok}
                  onChangeText={setSok}
                  placeholder={t("byggeplassVelger.sok")}
                  className="rounded bg-gray-100 px-3 py-2 text-base"
                />
              </View>
            )}
            <FlatList
              data={filtrerteByggeplasser}
              keyExtractor={(item) => item.id}
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onVelg(lokaltProjectId, item.id)}
                  className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                    item.id === valgtByggeplassId ? "bg-blue-50" : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-base text-gray-900">
                      {item.navn ?? item.id}
                    </Text>
                    {favorittIder.includes(item.id) ? (
                      <Text className="text-xs text-amber-600">
                        {t("byggeplassVelger.favoritt")}
                      </Text>
                    ) : (
                      item.number != null && (
                        <Text className="text-xs text-gray-500">
                          #{item.number}
                        </Text>
                      )
                    )}
                    {/* Fabel D: marker hvilken byggeplass «Arv fra dagskortet»
                        faktisk peker på. Ren visning — ingen logikkendring. */}
                    {sedelByggeplassId != null && item.id === sedelByggeplassId && (
                      <Text className="text-xs text-gray-500">
                        {t(kortVisning.arvesFra)}
                      </Text>
                    )}
                  </View>
                  {/* Stjerne-toggle (egen trykk-flate — velger ikke byggeplass). */}
                  <Pressable
                    onPress={() => toggleFavoritt(item.id)}
                    hitSlop={10}
                    className="px-1"
                  >
                    <Star
                      size={18}
                      color="#d97706"
                      fill={favorittIder.includes(item.id) ? "#d97706" : "none"}
                    />
                  </Pressable>
                  {item.id === valgtByggeplassId && (
                    <Check size={18} color="#1e40af" />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={() => {
                // Søk uten treff (cachen HAR data) → egen tilstand, ikke tri-tilstand.
                if (sok.trim() && byggeplasser.length > 0) {
                  return (
                    <View className="px-4 py-8">
                      <Text className="text-center text-gray-500">
                        {t("byggeplassVelger.ingenTreff")}
                      </Text>
                    </View>
                  );
                }
                // Tom cache — F2 tri-tilstand.
                if (laster) {
                  return (
                    <View className="items-center px-4 py-8">
                      <ActivityIndicator color="#1e40af" />
                      <Text className="mt-3 text-center text-gray-500">
                        {t("byggeplassVelger.lastes")}
                      </Text>
                    </View>
                  );
                }
                if (!erPaaNettet && !refreshFullført) {
                  return (
                    <View className="px-4 py-8">
                      <Text className="text-center text-gray-500">
                        {t("byggeplassVelger.offline")}
                      </Text>
                    </View>
                  );
                }
                if (refreshFullført) {
                  return (
                    <View className="px-4 py-8">
                      <Text className="text-center text-gray-500">
                        {t("byggeplassVelger.prosjektMangler")}
                      </Text>
                    </View>
                  );
                }
                // Initial (før effekten rakk å kjøre) — nøytral melding.
                return (
                  <View className="px-4 py-8">
                    <Text className="text-center text-gray-500">
                      {t("byggeplassVelger.ingen")}
                    </Text>
                  </View>
                );
              }}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/** Ordre (9): «Fra oppmøtested» — inline nedtrekk under låst reise-art (km-terskel,
 *  flere oppmøtesteder). Siste valg er forhåndsvalgt av kalleren. */
function OppmotestedVelger({
  tittel,
  placeholder,
  valgtId,
  steder,
  velg,
}: {
  tittel: string;
  placeholder: string;
  valgtId: string | null;
  steder: { id: string; navn: string }[];
  velg: (id: string) => void;
}) {
  const [apen, setApen] = useState(false);
  const valgt = steder.find((s) => s.id === valgtId) ?? null;
  return (
    <View className="mt-2">
      <Text className="mb-1 text-sm font-medium text-gray-700">{tittel}</Text>
      <Pressable
        onPress={() => setApen((a) => !a)}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5"
      >
        <Text className={`text-sm ${valgt ? "text-gray-900" : "text-gray-400"}`}>
          {valgt?.navn ?? placeholder}
        </Text>
        {apen ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
      </Pressable>
      {apen &&
        steder.map((sted) => (
          <Pressable
            key={sted.id}
            onPress={() => {
              velg(sted.id);
              setApen(false);
            }}
            className={`flex-row items-center justify-between border-b border-gray-100 px-3 py-2.5 ${
              sted.id === valgtId ? "bg-blue-50" : ""
            }`}
          >
            <Text className="text-sm text-gray-900">{sted.navn}</Text>
            {sted.id === valgtId && <Check size={16} color="#1e40af" />}
          </Pressable>
        ))}
    </View>
  );
}
