import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Car,
  ChevronDown,
  Split,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import {
  sheetTimerLocal,
  sheetMachineLocal,
  lonnsartLocal,
  aktivitetLocal,
  equipmentLocal,
  externalCostObjectLocal,
} from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../../services/kalenderKatalog";
import {
  hentStandardLonnsartLokalt,
  hentReiseLonnsartId,
} from "../../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import type {
  TimerRad,
  Lonnsart,
  Aktivitet,
  Underprosjekt,
} from "../../types/timer-detalj";
import {
  DEFAULT_PAUSE_ETTER_TIMER,
  effektiveTimerFraSpenn,
  hhmmTilMin,
  maskinBucketKapasitet,
  pauseOverlappMin,
  pauseVinduFra,
  tilFraAntall,
  tilErEtterFra,
  finnOverlappendeTidsrom,
} from "@sitedoc/shared";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";
import { FraTilTidFelt } from "./FraTilTidFelt";
import { VelgerFelt } from "./VelgerFelt";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import { EquipmentVelgerModal, EnhetVelgerModal } from "./MaskinSeksjon";
import { SplittRadModal } from "./SplittRadModal";

/** P1 (maskin-i-rad): valgfri maskin fra timerrad-modalens maskin-seksjon.
 *  null = ingen maskin valgt (ingen sheet_machine-rad skrives). */
type NyMaskin = {
  vehicleId: string;
  mengde: number | null;
  enhet: string | null;
};

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
  /** Sedel-nivå pause (min) — inngår i bucket-kapasitet for den valgfrie maskin-
   *  seksjonen på ny timer-rad (P1 maskin-i-rad, samme regel som MaskinRadModal). */
  pauseMin: number;
  /** P1 (maskin-i-rad): equipment-cache populert (Maskin-modul aktiv + firmaet
   *  har utstyr). Gater den valgfrie maskin-seksjonen på ny timer-rad. */
  harEquipmentCache: boolean;
  defaultAktivitetId: string | null;
  redigerbar: boolean;
  onEndret: () => void;
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
  pauseMin,
  harEquipmentCache,
  defaultAktivitetId,
  redigerbar,
  onEndret,
}: TimerSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);
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
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
      beskrivelse: string | null,
      maskin: NyMaskin | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetTimerLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: radProjectId,
          lonnsartId,
          aktivitetId,
          externalCostObjectId,
          timer,
          fraTid,
          tilTid,
          beskrivelse,
          sistEndretLokalt: Date.now(),
        })
        .run();
      // P1 (maskin-i-rad): dual-innsetting. Er maskin valgt i timerrad-modalens
      // maskin-seksjon, skriv en sheet_machine-rad med timer = timerradens antall
      // (herav-semantikk) i SAMME bucket (projectId + ECO) og med samme fra/til.
      // Feltene speiler MaskinSeksjons db.insert(sheetMachineLocal) nøyaktig.
      if (maskin) {
        db.insert(sheetMachineLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: sheetId,
            projectId: radProjectId,
            externalCostObjectId,
            vehicleId: maskin.vehicleId,
            timer,
            mengde: maskin.mengde,
            enhet: maskin.enhet,
            fraTid,
            tilTid,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
      onEndret();
    },
    [sheetId, onEndret],
  );

  const oppdater = useCallback(
    (
      radId: string,
      radProjectId: string,
      lonnsartId: string,
      aktivitetId: string,
      timer: number,
      externalCostObjectId: string | null,
      fraTid: string | null,
      tilTid: string | null,
      beskrivelse: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetTimerLocal)
        .set({
          projectId: radProjectId,
          lonnsartId,
          aktivitetId,
          timer,
          externalCostObjectId,
          fraTid,
          tilTid,
          beskrivelse,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTimerLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      db.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, radId)).run();
      onEndret();
    },
    [onEndret],
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
            erReise={reiseLonnsartId != null && rad.lonnsartId === reiseLonnsartId}
            redigerbar={redigerbar}
            onRediger={() => {
              setRedigerRadId(rad.id);
              setVisModal(true);
            }}
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
          onLagre={(
            radProjectId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            maskin,
          ) => {
            if (redigerRadId) {
              oppdater(
                redigerRadId,
                radProjectId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
              );
            } else {
              leggTil(
                radProjectId,
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
                maskin,
              );
            }
            setVisModal(false);
            setRedigerRadId(null);
          }}
          onLukk={() => {
            setVisModal(false);
            setRedigerRadId(null);
          }}
        />
      )}

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
  erReise,
  redigerbar,
  onRediger,
  onSplitt,
  onSlett,
}: {
  rad: TimerRad;
  erReise: boolean;
  redigerbar: boolean;
  onRediger: () => void;
  onSplitt: () => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
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
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
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

function TimerRadModal({
  sheetId,
  organizationId,
  defaultProjectId,
  defaultEcoId,
  dato,
  sheetPauseMin,
  harEquipmentCache,
  eksisterendeRader,
  alleTimerRader,
  defaultAktivitetId,
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  sheetId: string;
  organizationId: string;
  defaultProjectId: string;
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
  onLagre: (
    projectId: string,
    lonnsartId: string,
    aktivitetId: string,
    timer: number,
    externalCostObjectId: string | null,
    fraTid: string | null,
    tilTid: string | null,
    beskrivelse: string | null,
    maskin: NyMaskin | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  // T.5 + pause-synk: hent firma-innstillinger fra lokal cache.
  //   - tidsrundingMinutter: null = ingen runding
  //   - pauseEtterTimer/pauseMin: obligatorisk lunsjvindu (default 4,0 t inn i
  //     skiftet / 30 min), brukes til pause-bevisst auto-synk antall ↔ fra/til.
  const { tidsrundingMinutter, pauseEtterTimer, pauseMin } = useMemo(() => {
    const setting = hentOrganizationSettingLokalt(organizationId);
    return {
      tidsrundingMinutter: setting?.tidsrundingMinutter ?? null,
      pauseEtterTimer: setting?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER,
      pauseMin: setting?.standardPauseMin ?? 30,
    };
  }, [organizationId]);

  // Pausevindu = skiftstart + pauseEtterTimer. Skiftstart = dagens effektive
  // arbeidstid-start (kalender-overstyring eller firma-default).
  const pauseFra = useMemo(() => {
    const skiftStart = hentEffektivArbeidstidLokal(
      organizationId,
      new Date(`${dato}T00:00:00`),
    ).startTid;
    return pauseVinduFra(skiftStart, pauseEtterTimer);
  }, [organizationId, dato, pauseEtterTimer]);

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
    const effektiv = hentEffektivArbeidstidLokal(organizationId, new Date(`${dato}T00:00:00`));
    // Bolk (g) prefill-scope (M6, 2026-07-10): fra = seneste tilTid over HELE
    // sedelen (alle bøtter, `alleTimerRader`), beregnet som MAKS via hhmmTilMin
    // — ikke siste array-element (rekkefølge-uavhengig; speiler webs reduce i
    // `page.tsx` `onTilfoyTimer`). «Fortsett der du slapp» på hele dagen;
    // hindrer prefill inn i et allerede registrert tidsrom. `eksisterendeRader`
    // (bøtte-scopet) beholdes for lønnsart/aktivitet-prefill (`defaultValg`).
    const senesteTil = alleTimerRader
      .map((r) => r.tilTid)
      .filter((tid): tid is string => !!tid)
      .reduce<string | null>(
        (senest, tid) =>
          senest === null || hhmmTilMin(tid) > hhmmTilMin(senest) ? tid : senest,
        null,
      );
    return {
      fra: senesteTil ?? effektiv.startTid,
      til: effektiv.sluttTid,
    };
  }, [eksisterendeRad, alleTimerRader, organizationId, dato]);

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
    const sisteRad =
      eksisterendeRader.length > 0
        ? eksisterendeRader[eksisterendeRader.length - 1]
        : null;
    const firmaDefaultLonnsartId =
      hentStandardLonnsartLokalt(organizationId)?.id ?? "";
    return {
      lonnsartId: sisteRad?.lonnsartId ?? firmaDefaultLonnsartId,
      aktivitetId: sisteRad?.aktivitetId ?? defaultAktivitetId ?? "",
    };
  }, [eksisterendeRad, eksisterendeRader, defaultAktivitetId, organizationId]);

  const [valgtProjectId, setValgtProjectId] = useState<string>(
    eksisterendeRad?.projectId ?? defaultProjectId,
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
    // prefill. `pauseMin` her = firma standardPauseMin (utledet over). Ellers tom.
    if (prefillGyldig) {
      return effektiveTimerFraSpenn(
        defaultTider.fra!,
        defaultTider.til!,
        pauseFra,
        pauseMin,
      ).toFixed(2);
    }
    return "";
  });
  // T7-4e: defaultEcoId pre-selekteres når bruker klikker "+Legg til timer"
  // i en spesifikk ECO-bucket. Ved redigering brukes radens egen ECO.
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    eksisterendeRad?.externalCostObjectId ?? defaultEcoId,
  );
  const [fraTid, setFraTid] = useState<string | null>(defaultTider.fra);
  // Bolk (g)/web-speiling: til prefylles kun ved gyldig prefill (fra < til).
  const [tilTid, setTilTid] = useState<string | null>(
    prefillGyldig ? defaultTider.til : null,
  );
  const [beskrivelse, setBeskrivelse] = useState<string>(
    eksisterendeRad?.beskrivelse ?? "",
  );
  const [feil, setFeil] = useState<string | null>(null);
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);
  const [visLonnsartVelger, setVisLonnsartVelger] = useState(false);
  const [visAktivitetVelger, setVisAktivitetVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);
  // P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon — kun ved NY rad.
  // Ingen eget maskin-timer-felt: maskintimer settes lik timer-radens antall.
  const [visMaskin, setVisMaskin] = useState(false);
  const [maskinVehicleId, setMaskinVehicleId] = useState<string>("");
  const [maskinMengde, setMaskinMengde] = useState<string>("");
  const [maskinEnhet, setMaskinEnhet] = useState<string>("");
  const [visMaskinEquipmentVelger, setVisMaskinEquipmentVelger] = useState(false);
  const [visMaskinEnhetVelger, setVisMaskinEnhetVelger] = useState(false);

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
          effektiveTimerFraSpenn(hhmm, tilTid, pauseFra, pauseMin).toFixed(2),
        );
      }
    },
    [tilTid, pauseFra, pauseMin],
  );

  const handterTilEndret = useCallback(
    (hhmm: string) => {
      setTilTid(hhmm);
      if (fraTid) {
        setTimer(
          effektiveTimerFraSpenn(fraTid, hhmm, pauseFra, pauseMin).toFixed(2),
        );
      }
    },
    [fraTid, pauseFra, pauseMin],
  );

  const handterTimerEndret = useCallback(
    (tekst: string) => {
      setTimer(tekst);
      const n = parseFloat(tekst.replace(",", "."));
      if (fraTid && !isNaN(n) && n > 0 && n <= 24) {
        setTilTid(tilFraAntall(fraTid, n, pauseFra, pauseMin));
      }
    },
    [fraTid, pauseFra, pauseMin],
  );

  // Transparens: hvor mange minutter pause raden faktisk absorberer (0 = ingen).
  const pauseOverlapp = useMemo(() => {
    if (!fraTid || !tilTid) return 0;
    const fm = hhmmTilMin(fraTid);
    const tm = hhmmTilMin(tilTid);
    if (tm <= fm) return 0;
    return pauseOverlappMin(fm, tm, hhmmTilMin(pauseFra), pauseMin);
  }, [fraTid, tilTid, pauseFra, pauseMin]);

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

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

  // P1 (maskin-i-rad): valgt utstyr for VelgerFelt-visning i maskin-seksjonen.
  const valgtMaskinEquipment = useMemo(() => {
    if (!maskinVehicleId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, maskinVehicleId))
        .all()[0] ?? null
    );
  }, [maskinVehicleId]);

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
    const arbeidSum = db
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all()
      .filter(iBucket)
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
  }, [sheetId, valgtProjectId, valgtEcoId, sheetPauseMin, defaultProjectId]);

  // Speiler web-TimerRadDialogs disabled-logikk: kjernefeltene + fra/til
  // obligatorisk på timer-rader (2026-07-13, reverserer a2). Validering i lagre()
  // beholdes (viser konkret feilmelding); dette er UI-hintet.
  const kanLagre =
    !!valgtProjectId &&
    !!valgtLonnsartId &&
    !!valgtAktivitetId &&
    !!timer.trim() &&
    !!fraTid &&
    !!tilTid;

  function lagre() {
    setFeil(null);
    if (!valgtProjectId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtLonnsartId) {
      setFeil(t("timer.feil.lonnsartPaakrevd"));
      return;
    }
    if (!valgtAktivitetId) {
      setFeil(t("timer.feil.aktivitetPaakrevd"));
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
    if (fraTid && tilTid) {
      const forventet = effektiveTimerFraSpenn(fraTid, tilTid, pauseFra, pauseMin);
      if (Math.abs(forventet - tall) > 0.01) {
        setFeil(t("timer.feil.timerAvvik", { forventet: forventet.toFixed(2) }));
        return;
      }
    }
    // P1 (maskin-i-rad): bygg valgfri maskin. Ingen utstyr valgt → null (ingen
    // sheet_machine-rad). Maskintimer settes i leggTil lik timer-radens antall.
    const mengdeNum =
      maskinVehicleId && maskinMengde.trim()
        ? parseFloat(maskinMengde.replace(",", "."))
        : NaN;
    const maskin: NyMaskin | null = maskinVehicleId
      ? {
          vehicleId: maskinVehicleId,
          mengde: isNaN(mengdeNum) ? null : mengdeNum,
          enhet: maskinEnhet || null,
        }
      : null;
    onLagre(
      valgtProjectId,
      valgtLonnsartId,
      valgtAktivitetId,
      tall,
      valgtEcoId,
      fraTid,
      tilTid,
      beskrivelse.trim() || null,
      maskin,
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

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.prosjekt")} *
            </Text>
            <ProsjektFelt
              prosjektNavn={valgtProsjekt?.name ?? null}
              prosjektNummer={valgtProsjekt?.projectNumber ?? null}
              onTrykk={() => setVisProsjektVelger(true)}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.lonnsart")} *
            </Text>
            <VelgerFelt
              verdi={valgtLonnsart?.navn ?? null}
              placeholder={t("timer.velgLonnsart")}
              onPress={() => setVisLonnsartVelger(true)}
            />
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

          {/* Underprosjekt (valgfritt) — Tilleggsarbeid, Endring m.fl. */}
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
            />
          </View>

          {/* T.12: fritekst per rad — «hva gjorde du?» (valgfritt) */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.radBeskrivelse")}
            </Text>
            <TextInput
              value={beskrivelse}
              onChangeText={setBeskrivelse}
              placeholder={t("timer.radBeskrivelsePlaceholder")}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="min-h-[72px] rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          {/* P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon — kun ved NY
              rad, og kun når equipment-cache er populert (samme gating som den
              tidligere «+ Legg til maskin»-knappen). Maskintimer settes lik
              timer-radens antall; kortere drift redigeres på maskin-raden etterpå. */}
          {!eksisterendeRad && harEquipmentCache && (
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
                  <View>
                    <Text className="mb-1 text-sm font-medium text-gray-700">
                      {t("timer.felt.utstyr")}
                    </Text>
                    <VelgerFelt
                      verdi={
                        valgtMaskinEquipment
                          ? `${valgtMaskinEquipment.merke ?? ""} ${valgtMaskinEquipment.modell ?? ""}`.trim() ||
                            valgtMaskinEquipment.internNavn ||
                            null
                          : null
                      }
                      placeholder={t("timer.velgUtstyr")}
                      onPress={() => setVisMaskinEquipmentVelger(true)}
                      underTekst={
                        valgtMaskinEquipment?.internNummer
                          ? `#${valgtMaskinEquipment.internNummer}`
                          : null
                      }
                    />
                  </View>
                  <View>
                    <Text className="mb-1 text-sm font-medium text-gray-700">
                      {t("timer.felt.mengde")}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        value={maskinMengde}
                        onChangeText={setMaskinMengde}
                        placeholder="0,00"
                        keyboardType="decimal-pad"
                        inputAccessoryViewID={TASTATUR_FERDIG_ID}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
                      />
                      <VelgerFelt
                        verdi={maskinEnhet || null}
                        placeholder={t("timer.felt.enhet")}
                        onPress={() => setVisMaskinEnhetVelger(true)}
                      />
                    </View>
                  </View>
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

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <Pressable
            onPress={lagre}
            disabled={!kanLagre}
            className={`mt-4 items-center rounded-lg px-6 py-4 ${
              kanLagre ? "bg-blue-600 active:bg-blue-700" : "bg-blue-300"
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {t("handling.lagre")}
            </Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
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

        {visProsjektVelger && (
          <ProsjektVelgerModal
            organizationId={organizationId}
            valgtId={valgtProjectId}
            onVelg={(id) => {
              setValgtProjectId(id);
              // Nullstill ECO ved prosjekt-bytte — ECO er prosjekt-spesifikk
              setValgtEcoId(null);
              setVisProsjektVelger(false);
            }}
            onLukk={() => setVisProsjektVelger(false)}
          />
        )}

        {/* P1 (maskin-i-rad): gjenbrukte velgere fra MaskinSeksjon for den
            valgfrie maskin-seksjonen (utstyr + enhet). */}
        {visMaskinEquipmentVelger && (
          <EquipmentVelgerModal
            organizationId={organizationId}
            valgtId={maskinVehicleId}
            brukt={bruktVehicleIds}
            onVelg={(id) => {
              setMaskinVehicleId(id);
              setVisMaskinEquipmentVelger(false);
            }}
            onLukk={() => setVisMaskinEquipmentVelger(false)}
          />
        )}

        {visMaskinEnhetVelger && (
          <EnhetVelgerModal
            valgt={maskinEnhet}
            onVelg={(v) => {
              setMaskinEnhet(v);
              setVisMaskinEnhetVelger(false);
            }}
            onLukk={() => setVisMaskinEnhetVelger(false)}
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
