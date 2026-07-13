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
  AlertTriangle,
  Truck,
  Wrench,
  Hammer,
  Split,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import {
  sheetMachineLocal,
  sheetTimerLocal,
  slettedeRaderLocal,
  equipmentLocal,
  externalCostObjectLocal,
} from "../../db/schema";
import {
  DEFAULT_PAUSE_ETTER_TIMER,
  effektiveTimerFraSpenn,
  hhmmTilMin,
  maskinBucketKapasitet,
  overstigerMaskinTak,
  pauseVinduFra,
  tilFraAntall,
  tilErEtterFra,
} from "@sitedoc/shared";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../../services/kalenderKatalog";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { ENHETER } from "../../lib/enheter";
import type { MaskinRad, Equipment } from "../../types/timer-detalj";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";
import { FraTilTidFelt } from "./FraTilTidFelt";
import { UnderprosjektVelgerModal } from "./TimerSeksjon";
import { VelgerFelt } from "./VelgerFelt";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import { SplittRadModal } from "./SplittRadModal";

type MaskinKategori = "kjoretoy" | "anleggsmaskin" | "smautstyr";
const MASKIN_KATEGORIER: MaskinKategori[] = [
  "kjoretoy",
  "anleggsmaskin",
  "smautstyr",
];
const KATEGORI_IKON: Record<MaskinKategori, typeof Truck> = {
  kjoretoy: Truck,
  anleggsmaskin: Wrench,
  smautstyr: Hammer,
};

/** Numerisk-aware sammenligning av internNummer (tomme sist). */
function sammenlignInternNummer(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, "nb");
}

interface MaskinSeksjonProps {
  sheetId: string;
  rader: MaskinRad[];
  organizationId: string;
  projectId: string;
  /** T7-4e (2026-05-16): ECO-filter for å pre-selektere i Add-modal og holde
   *  nye rader i samme (projectId, ECO)-bucket som parent EcoBucket. null =
   *  hovedgruppe (ingen ECO). */
  defaultEcoId?: string | null;
  /** T7-4e: skjul intern header når MaskinSeksjon rendres inne i EcoBucket
   *  (ECO-subheaderen står for kontekst der). */
  visHeader?: boolean;
  /** ISO YYYY-MM-DD — dato på dagsseddelen. Brukes til kalender-utleting (T4-e). */
  dato: string;
  /** Sedel-nivå pause (min) — inngår i maskin ≤ arbeid-kapasitet (Del 2). */
  pauseMin: number;
  harEquipmentCache: boolean;
  /** T.11: false når innlogget bruker mangler gyldig maskinførerbevis i org.
   *  Styrer soft-varsel — påvirker ALDRI synlighet eller lagring. */
  harMaskinforerbevis: boolean;
  redigerbar: boolean;
  onEndret: () => void;
}

export function MaskinSeksjon({
  sheetId,
  rader,
  organizationId,
  projectId,
  defaultEcoId = null,
  visHeader = true,
  dato,
  pauseMin,
  harEquipmentCache,
  harMaskinforerbevis,
  redigerbar,
  onEndret,
}: MaskinSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);
  // P2 (arbeider-splitt): raden som splittes (kun draft/returned via redigerbar).
  const [splittRadId, setSplittRadId] = useState<string | null>(null);

  const leggTil = useCallback(
    (
      radProjectId: string,
      ecoId: string | null,
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetMachineLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: radProjectId,
          externalCostObjectId: ecoId,
          vehicleId,
          timer,
          mengde,
          enhet,
          fraTid,
          tilTid,
          sistEndretLokalt: Date.now(),
        })
        .run();
      onEndret();
    },
    [sheetId, onEndret],
  );

  const oppdater = useCallback(
    (
      radId: string,
      radProjectId: string,
      ecoId: string | null,
      vehicleId: string,
      timer: number,
      mengde: number | null,
      enhet: string | null,
      fraTid: string | null,
      tilTid: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetMachineLocal)
        .set({
          projectId: radProjectId,
          externalCostObjectId: ecoId,
          vehicleId,
          timer,
          mengde,
          enhet,
          fraTid,
          tilTid,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetMachineLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      // S-A: slett lokalt + skriv tombstone ATOMISK (samme tx) — se TimerSeksjon.
      db.transaction((tx) => {
        tx.delete(sheetMachineLocal)
          .where(eq(sheetMachineLocal.id, radId))
          .run();
        tx.insert(slettedeRaderLocal)
          .values({
            radId,
            dagsseddelId: sheetId,
            radType: "maskin",
            slettetVed: Date.now(),
          })
          .onConflictDoNothing()
          .run();
      });
      onEndret();
    },
    [onEndret, sheetId],
  );

  // P1 (maskin-i-rad): soft-skjul gjelder nå kun fravær av rader. Ny maskin
  // legges via timerrad-modalens valgfrie maskin-seksjon (ikke en egen add-knapp
  // her), så seksjonen rendres utelukkende for å VISE + inline-redigere
  // eksisterende maskin-rader. Ingen rader → ingenting å vise.
  if (rader.length === 0) return null;

  return (
    <View className={visHeader ? "mt-4" : ""}>
      {/* T.11: soft-varsel når arbeider mangler gyldig maskinførerbevis.
          Informativt («flagget for synlighet»), aldri blokkerende. */}
      {harEquipmentCache && !harMaskinforerbevis && (
        <View className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={14} color="#b45309" />
            <Text className="flex-1 text-xs text-amber-800">
              {t("timer.maskinforerbevis.arbeider")}
            </Text>
          </View>
        </View>
      )}
      {visHeader && (
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.kol.maskiner")}
          </Text>
          {redigerbar && harEquipmentCache && (
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
      {rader.map((rad) => (
        <MaskinRadVis
          key={rad.id}
          rad={rad}
          redigerbar={redigerbar}
          onRediger={() => {
            setRedigerRadId(rad.id);
            setVisModal(true);
          }}
          onSplitt={() => setSplittRadId(rad.id)}
          onSlett={() => fjern(rad.id)}
        />
      ))}

      {visModal && (
        <MaskinRadModal
          sheetId={sheetId}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultEcoId={defaultEcoId}
          dato={dato}
          pauseMin={pauseMin}
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          onLagre={(
            radProjectId,
            ecoId,
            vehicleId,
            timer,
            mengde,
            enhet,
            fraTid,
            tilTid,
          ) => {
            if (redigerRadId) {
              oppdater(
                redigerRadId,
                radProjectId,
                ecoId,
                vehicleId,
                timer,
                mengde,
                enhet,
                fraTid,
                tilTid,
              );
            } else {
              leggTil(
                radProjectId,
                ecoId,
                vehicleId,
                timer,
                mengde,
                enhet,
                fraTid,
                tilTid,
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

      {/* P2 (arbeider-splitt): ren lokal Drizzle-splitt av valgt maskin-rad. */}
      {splittRadId &&
        (() => {
          const rad = rader.find((r) => r.id === splittRadId);
          if (!rad) return null;
          return (
            <SplittRadModal
              radType="maskin"
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

function MaskinRadVis({
  rad,
  redigerbar,
  onRediger,
  onSplitt,
  onSlett,
}: {
  rad: MaskinRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSplitt: () => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const equipment = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, rad.vehicleId))
        .all()[0] ?? null
    );
  }, [rad.vehicleId]);

  const navn = equipment
    ? `${equipment.merke ?? ""} ${equipment.modell ?? ""}`.trim() ||
      equipment.internNavn ||
      rad.vehicleId
    : rad.vehicleId;

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        {/* P1 (maskin-i-rad): slate «MASKIN»-merke skiller maskin-rader fra
            timer-rader når de står i samme rad-liste. */}
        <View className="flex-row items-center gap-2">
          <View className="rounded bg-slate-100 px-1.5 py-0.5">
            <Text className="text-[10px] font-semibold uppercase text-slate-600">
              {t("timer.maskinSeksjon.merke")}
            </Text>
          </View>
          <Text className="flex-1 text-base text-gray-900">{navn}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {equipment?.internNummer && (
            <Text className="text-xs text-gray-500">#{equipment.internNummer}</Text>
          )}
          {equipment?.registreringsnummer && (
            <Text className="text-xs text-gray-500">
              {equipment.registreringsnummer}
            </Text>
          )}
          {rad.mengde !== null && rad.mengde !== undefined && (
            <Text className="text-xs text-gray-500">
              {rad.mengde.toFixed(2)} {rad.enhet ?? ""}
            </Text>
          )}
          {rad.fraTid && rad.tilTid && (
            <Text className="text-xs text-gray-500">
              {rad.fraTid}–{rad.tilTid}
            </Text>
          )}
        </View>
      </View>
      <Text className="font-mono text-base text-gray-900">{rad.timer.toFixed(2)}</Text>
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

function MaskinRadModal({
  sheetId,
  organizationId,
  defaultProjectId,
  defaultEcoId,
  dato,
  pauseMin,
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  sheetId: string;
  organizationId: string;
  defaultProjectId: string;
  defaultEcoId: string | null;
  dato: string;
  pauseMin: number;
  eksisterendeRad: MaskinRad | null;
  onLagre: (
    projectId: string,
    ecoId: string | null,
    vehicleId: string,
    timer: number,
    mengde: number | null,
    enhet: string | null,
    fraTid: string | null,
    tilTid: string | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  // T.5 + B1 (M5, 2026-07-10): firma-tidsrunding + pause-parametre fra lokal
  // cache. Maskin følger FØRERENS pause (B1) → standardPauseMin (firma-default),
  // IKKE sedel-`pauseMin` (som er Del 2 bucket-taket). Speiler TimerSeksjon.
  const { tidsrundingMinutter, standardPauseMin, pauseEtterTimer } = useMemo(() => {
    const setting = hentOrganizationSettingLokalt(organizationId);
    return {
      tidsrundingMinutter: setting?.tidsrundingMinutter ?? null,
      standardPauseMin: setting?.standardPauseMin ?? 30,
      pauseEtterTimer: setting?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER,
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

  // B4-prefill (M5, 2026-07-10): for NY rad foreslå maskinens DRIFTSVINDU fra
  // bucketens ARBEIDSSPENN — første timer-rads fraTid + siste timer-rads tilTid
  // i (defaultProjectId, defaultEcoId)-bucketen (speiler webs MaskinRadDialog:
  // timerRaderIBucket[0].fraTid / .at(-1).tilTid). Faller til kalenderens
  // effektive start/slutt når bucketen er tom. Rediger bruker radens egne.
  const defaultTider = useMemo(() => {
    if (eksisterendeRad) {
      return {
        fra: eksisterendeRad.fraTid ?? null,
        til: eksisterendeRad.tilTid ?? null,
      };
    }
    const effektiv = hentEffektivArbeidstidLokal(
      organizationId,
      new Date(`${dato}T00:00:00`),
    );
    const db = hentDatabase();
    const bucketTimer = db
      ? db
          .select()
          .from(sheetTimerLocal)
          .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
          .all()
          .filter(
            (r) =>
              (r.projectId ?? defaultProjectId) === defaultProjectId &&
              (r.externalCostObjectId ?? null) === (defaultEcoId ?? null),
          )
      : [];
    return {
      fra: bucketTimer[0]?.fraTid ?? effektiv.startTid,
      til: bucketTimer[bucketTimer.length - 1]?.tilTid ?? effektiv.sluttTid,
    };
  }, [eksisterendeRad, organizationId, dato, sheetId, defaultProjectId, defaultEcoId]);

  const [valgtProjectId, setValgtProjectId] = useState<string>(
    eksisterendeRad?.projectId ?? defaultProjectId,
  );
  const [valgtVehicleId, setValgtVehicleId] = useState<string>(
    eksisterendeRad?.vehicleId ?? "",
  );
  const [timer, setTimer] = useState<string>(() => {
    if (eksisterendeRad?.timer) return eksisterendeRad.timer.toFixed(2);
    // B3 (M5): init antall fra prefill-spennet (pause-bevisst) når begge tider
    // er gyldige (fra < til). Ellers tom — ingen 0-rad.
    if (
      defaultTider.fra &&
      defaultTider.til &&
      hhmmTilMin(defaultTider.fra) < hhmmTilMin(defaultTider.til)
    ) {
      return effektiveTimerFraSpenn(
        defaultTider.fra,
        defaultTider.til,
        pauseFra,
        standardPauseMin,
      ).toFixed(2);
    }
    return "";
  });
  const [mengde, setMengde] = useState<string>(
    eksisterendeRad?.mengde !== null && eksisterendeRad?.mengde !== undefined
      ? eksisterendeRad.mengde.toFixed(2)
      : "",
  );
  const [enhet, setEnhet] = useState<string>(eksisterendeRad?.enhet ?? "");
  const [fraTid, setFraTid] = useState<string | null>(defaultTider.fra);
  const [tilTid, setTilTid] = useState<string | null>(defaultTider.til);
  // T7-4e: ECO på maskin — pre-selekteres fra eksisterende rad eller defaultEcoId.
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    eksisterendeRad?.externalCostObjectId ?? defaultEcoId,
  );
  const [feil, setFeil] = useState<string | null>(null);
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);
  const [visEquipmentVelger, setVisEquipmentVelger] = useState(false);
  const [visEnhetVelger, setVisEnhetVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);

  // B1/B2-synk (M5, 2026-07-10): pause-bevisst auto-synk antall ↔ fra/til, sist-
  // rørte felt vinner. Bruker standardPauseMin (B1: maskin følger føreren).
  // Speiler TimerSeksjons handtere*-mønster.
  const handterFraEndret = useCallback(
    (hhmm: string) => {
      setFraTid(hhmm);
      if (tilTid) {
        setTimer(
          effektiveTimerFraSpenn(hhmm, tilTid, pauseFra, standardPauseMin).toFixed(2),
        );
      }
    },
    [tilTid, pauseFra, standardPauseMin],
  );
  const handterTilEndret = useCallback(
    (hhmm: string) => {
      setTilTid(hhmm);
      if (fraTid) {
        setTimer(
          effektiveTimerFraSpenn(fraTid, hhmm, pauseFra, standardPauseMin).toFixed(2),
        );
      }
    },
    [fraTid, pauseFra, standardPauseMin],
  );
  const handterTimerEndret = useCallback(
    (tekst: string) => {
      setTimer(tekst);
      const n = parseFloat(tekst.replace(",", "."));
      if (fraTid && !isNaN(n) && n > 0 && n <= 24) {
        setTilTid(tilFraAntall(fraTid, n, pauseFra, standardPauseMin));
      }
    },
    [fraTid, pauseFra, standardPauseMin],
  );

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

  const valgtEquipment = useMemo(() => {
    if (!valgtVehicleId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, valgtVehicleId))
        .all()[0] ?? null
    );
  }, [valgtVehicleId]);

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

  // Del 1: maskiner allerede brukt på seddelen — løftes øverst i velgeren.
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

  // Del 2 (maskin ≤ arbeid): reaktiv bucket-kapasitet for gjeldende
  // (valgtProjectId, valgtEcoId). Leser sedelens rader fra SQLite så den
  // er korrekt også når bruker bytter prosjekt/ECO i modalen. Delt
  // @sitedoc/shared-regel — identisk med serverens validerMaskinUnderArbeid.
  const kapasitet = useMemo(() => {
    const db = hentDatabase();
    if (!db)
      return { arbeidSum: 0, sumMaskinEksisterende: 0, ledig: 0, overstiger: false };
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
    const sumMaskinEksisterende = db
      .select()
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all()
      .filter((r) => iBucket(r) && r.id !== eksisterendeRad?.id)
      .reduce((acc, r) => acc + (r.timer ?? 0), 0);
    const { ledig } = maskinBucketKapasitet({
      arbeidSum,
      sumMaskinEksisterende,
      pauseMin,
    });
    const nyTimer = parseFloat(timer.replace(",", "."));
    const nyBidrag = isNaN(nyTimer) ? 0 : nyTimer;
    const overstiger = overstigerMaskinTak(
      sumMaskinEksisterende + nyBidrag,
      arbeidSum,
      pauseMin,
    );
    return { arbeidSum, sumMaskinEksisterende, ledig, overstiger };
  }, [
    sheetId,
    valgtProjectId,
    valgtEcoId,
    timer,
    pauseMin,
    eksisterendeRad?.id,
    defaultProjectId,
  ]);

  function lagre() {
    setFeil(null);
    if (!valgtProjectId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtVehicleId) {
      setFeil(t("timer.feil.utstyrPaakrevd"));
      return;
    }
    const tall = parseFloat(timer.replace(",", "."));
    if (isNaN(tall) || tall <= 0 || tall > 24) {
      setFeil(t("timer.feil.ugyldigTimer"));
      return;
    }
    let mengdeNum: number | null = null;
    if (mengde.trim()) {
      mengdeNum = parseFloat(mengde.replace(",", "."));
      if (isNaN(mengdeNum) || mengdeNum < 0) {
        setFeil(t("timer.feil.ugyldigMengde"));
        return;
      }
    }
    // T4-e: fraTid < tilTid hvis begge satt. Delt regel (@sitedoc/shared).
    if (!tilErEtterFra(fraTid, tilTid)) {
      setFeil(t("timer.feil.sluttForStart"));
      return;
    }
    // B2 (M5, 2026-07-10): når begge tider er satt MÅ antall stemme med
    // (spenn − pause). Auto-synken holder dem i takt; dette er sikkerhetsnettet
    // mot manuell desync. Klient-only — serveren håndhever ikke B2 (se BACKLOG).
    if (fraTid && tilTid) {
      const forventet = effektiveTimerFraSpenn(fraTid, tilTid, pauseFra, standardPauseMin);
      if (Math.abs(forventet - tall) > 0.01) {
        setFeil(t("timer.feil.timerAvvik", { forventet: forventet.toFixed(2) }));
        return;
      }
    }
    onLagre(
      valgtProjectId,
      valgtEcoId,
      valgtVehicleId,
      tall,
      mengdeNum,
      enhet || null,
      fraTid,
      tilTid,
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
            {eksisterendeRad ? t("timer.rediger.maskin") : t("timer.tilfoy.maskin")}
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
              {t("timer.felt.utstyr")} *
            </Text>
            <VelgerFelt
              verdi={
                valgtEquipment
                  ? `${valgtEquipment.merke ?? ""} ${valgtEquipment.modell ?? ""}`.trim() ||
                    valgtEquipment.internNavn ||
                    null
                  : null
              }
              placeholder={t("timer.velgUtstyr")}
              onPress={() => setVisEquipmentVelger(true)}
              underTekst={
                valgtEquipment?.internNummer
                  ? `#${valgtEquipment.internNummer}`
                  : null
              }
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

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.mengde")}
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={mengde}
                onChangeText={setMengde}
                placeholder="0,00"
                keyboardType="decimal-pad"
                inputAccessoryViewID={TASTATUR_FERDIG_ID}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
              />
              <VelgerFelt
                verdi={enhet || null}
                placeholder={t("timer.felt.enhet")}
                onPress={() => setVisEnhetVelger(true)}
              />
            </View>
          </View>

          {/* T4-e: Fra-/til-tid per maskin-rad. Forhåndsutfylling fra kalender.
              T.5: avrunding via firma-setting. */}
          <FraTilTidFelt
            fraTid={fraTid}
            tilTid={tilTid}
            tidsrundingMinutter={tidsrundingMinutter}
            onFraEndret={handterFraEndret}
            onTilEndret={handterTilEndret}
          />

          {/* T7-4e: ECO (underprosjekt) — speil av TimerRadModals ECO-velger.
              Maskin følger samme prosjekt+ECO-gruppe som arbeidstimer (T.7). */}
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

          {/* Del 2: inline kapasitet-linje for bucketen. Rød ved overskridelse;
              Lagre disables da (samme regel som server). */}
          <View
            className={`rounded-lg border px-3 py-2 ${
              kapasitet.overstiger
                ? "border-red-300 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <Text
              className={`text-xs ${
                kapasitet.overstiger ? "text-red-800" : "text-gray-500"
              }`}
            >
              {t("timer.maskin.kapasitet", {
                arbeid: kapasitet.arbeidSum.toFixed(2),
                maskin: kapasitet.sumMaskinEksisterende.toFixed(2),
                ledig: Math.max(0, kapasitet.ledig).toFixed(2),
              })}
            </Text>
            {kapasitet.overstiger && (
              <Text className="mt-0.5 text-xs font-medium text-red-800">
                {t("timer.maskin.overstigerArbeid")}
              </Text>
            )}
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <Pressable
            onPress={lagre}
            disabled={kapasitet.overstiger}
            className={`mt-4 items-center rounded-lg px-6 py-4 ${
              kapasitet.overstiger
                ? "bg-gray-300"
                : "bg-blue-600 active:bg-blue-700"
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                kapasitet.overstiger ? "text-gray-500" : "text-white"
              }`}
            >
              {t("handling.lagre")}
            </Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
        <TastaturFerdig />

        {visEquipmentVelger && (
          <EquipmentVelgerModal
            organizationId={organizationId}
            valgtId={valgtVehicleId}
            brukt={bruktVehicleIds}
            onVelg={(id) => {
              setValgtVehicleId(id);
              setVisEquipmentVelger(false);
            }}
            onLukk={() => setVisEquipmentVelger(false)}
          />
        )}

        {visEnhetVelger && (
          <EnhetVelgerModal
            valgt={enhet}
            onVelg={(v) => {
              setEnhet(v);
              setVisEnhetVelger(false);
            }}
            onLukk={() => setVisEnhetVelger(false)}
          />
        )}

        {visProsjektVelger && (
          <ProsjektVelgerModal
            organizationId={organizationId}
            valgtId={valgtProjectId}
            onVelg={(id) => {
              setValgtProjectId(id);
              // Nullstill ECO ved prosjekt-bytte — ECO er prosjekt-spesifikk.
              setValgtEcoId(null);
              setVisProsjektVelger(false);
            }}
            onLukk={() => setVisProsjektVelger(false)}
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
      </SafeAreaView>
    </Modal>
  );
}

function KategoriChip({
  label,
  ikon: Ikon,
  aktiv,
  onPress,
}: {
  label: string;
  ikon?: typeof Truck;
  aktiv: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
        aktiv ? "bg-sitedoc-primary" : "bg-gray-100"
      }`}
    >
      {Ikon && <Ikon size={13} color={aktiv ? "#ffffff" : "#4b5563"} />}
      <Text
        className={`text-xs font-medium ${
          aktiv ? "text-white" : "text-gray-600"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// P1 (maskin-i-rad): eksportert for gjenbruk i TimerRadModal (valgfri maskin-
// seksjon på ny timer-rad — samme utstyrsvelger som MaskinRadModal).
export function EquipmentVelgerModal({
  organizationId,
  valgtId,
  brukt = [],
  onVelg,
  onLukk,
}: {
  organizationId: string;
  valgtId: string;
  /** vehicleId-er allerede i bruk på seddelen — løftes øverst (Del 1). */
  brukt?: string[];
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const [kategori, setKategori] = useState<MaskinKategori | null>(null);

  const equipment = useMemo<Equipment[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    // Vis alle ikke-utgåtte (per anbefaling) — feltarbeider kan registrere
    // bruk på paa_service-utstyr hvis sjekklisten ble brukt før det havnet
    // på service. Utgåtte (status="utgaatt") ekskluderes — gamle
    // sheet_machine-rader viser fortsatt navn via finnEquipmentLokalt.
    return db
      .select()
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, organizationId))
      .all()
      .filter((e) => e.status !== "utgaatt");
  }, [organizationId]);

  const antallPerKategori = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of equipment)
      if (e.kategori) m.set(e.kategori, (m.get(e.kategori) ?? 0) + 1);
    return m;
  }, [equipment]);

  const bruktSet = useMemo(() => new Set(brukt), [brukt]);

  const filtrert = useMemo(() => {
    const q = sok.toLowerCase().trim();
    const treff = equipment.filter((e) => {
      if (kategori && e.kategori !== kategori) return false;
      if (!q) return true;
      return (
        (e.merke ?? "").toLowerCase().includes(q) ||
        (e.modell ?? "").toLowerCase().includes(q) ||
        (e.internNavn ?? "").toLowerCase().includes(q) ||
        (e.internNummer ?? "").toLowerCase().includes(q) ||
        (e.registreringsnummer ?? "").toLowerCase().includes(q)
      );
    });
    // Sortering: brukt-på-seddelen først → internNummer (numerisk) → navn.
    return treff.sort((a, b) => {
      const aB = bruktSet.has(a.id);
      const bB = bruktSet.has(b.id);
      if (aB !== bB) return aB ? -1 : 1;
      const nr = sammenlignInternNummer(a.internNummer, b.internNummer);
      if (nr !== 0) return nr;
      return `${a.merke ?? ""} ${a.modell ?? ""}`
        .trim()
        .localeCompare(`${b.merke ?? ""} ${b.modell ?? ""}`.trim(), "nb");
    });
  }, [equipment, sok, kategori, bruktSet]);

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
            {t("timer.velgUtstyr")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {equipment.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        {/* Del 1: kategori-filter (enkel-select) — speiler /dashbord/maskin. */}
        {equipment.length > 0 && (
          <View className="border-b border-gray-200">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-2 px-4 py-2"
            >
              <KategoriChip
                label={t("maskin.filter.alle")}
                aktiv={kategori === null}
                onPress={() => setKategori(null)}
              />
              {MASKIN_KATEGORIER.map((k) => {
                const Ikon = KATEGORI_IKON[k];
                return (
                  <KategoriChip
                    key={k}
                    label={`${t(
                      `maskin.kategori${k.charAt(0).toUpperCase() + k.slice(1)}`,
                    )} (${antallPerKategori.get(k) ?? 0})`}
                    ikon={Ikon}
                    aktiv={kategori === k}
                    onPress={() => setKategori(kategori === k ? null : k)}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const navn =
              `${item.merke ?? ""} ${item.modell ?? ""}`.trim() ||
              item.internNavn ||
              item.id;
            const meta = [
              item.internNavn && item.merke ? item.internNavn : null,
              item.internNummer ? `#${item.internNummer}` : null,
              item.registreringsnummer,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Pressable
                onPress={() => onVelg(item.id)}
                className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                  item.id === valgtId ? "bg-blue-50" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-base text-gray-900">{navn}</Text>
                  {meta && <Text className="text-xs text-gray-500">{meta}</Text>}
                  {bruktSet.has(item.id) && (
                    <Text className="text-xs text-sitedoc-primary">
                      {t("timer.maskin.bruktPaaSeddel")}
                    </Text>
                  )}
                </View>
                {item.id === valgtId && <Check size={18} color="#1e40af" />}
              </Pressable>
            );
          }}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenUtstyr")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// P1 (maskin-i-rad): eksportert for gjenbruk i TimerRadModal (enhet på den
// valgfrie maskin-seksjonen).
export function EnhetVelgerModal({
  valgt,
  onVelg,
  onLukk,
}: {
  valgt: string;
  onVelg: (v: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
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
            {t("timer.felt.enhet")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        <Pressable
          onPress={() => onVelg("")}
          className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
            valgt === "" ? "bg-blue-50" : ""
          }`}
        >
          <Text className="flex-1 text-base text-gray-500">—</Text>
          {valgt === "" && <Check size={18} color="#1e40af" />}
        </Pressable>
        {ENHETER.map((e) => (
          <Pressable
            key={e}
            onPress={() => onVelg(e)}
            className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
              valgt === e ? "bg-blue-50" : ""
            }`}
          >
            <Text className="flex-1 text-base text-gray-900">{e}</Text>
            {valgt === e && <Check size={18} color="#1e40af" />}
          </Pressable>
        ))}
      </SafeAreaView>
    </Modal>
  );
}
