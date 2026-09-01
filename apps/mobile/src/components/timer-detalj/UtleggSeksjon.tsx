import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet (2 modaler i fila) — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Trash2, Pencil, X, Check, Camera, ImagePlus, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import {
  krevesBelop,
  kreverKvittering,
  baeresAvSheetUtlegg,
  type UtleggOrdning,
} from "@sitedoc/shared";
import { hentDatabase } from "../../db/database";
import {
  sheetUtleggLocal,
  sheetUtleggVedleggLocal,
  slettedeRaderLocal,
} from "../../db/schema";
import {
  hentUtleggskategorierLokalt,
  finnUtleggskategoriLokalt,
  utledOrdningLokalt,
  utledOrdningOgKildeLokalt,
} from "../../services/timerKatalog";
import { taBilde, velgBilde } from "../../services/bilde";
import { lagreLokaltBilde, slettLokaltBilde } from "../../services/lokalBilde";
import { fjernUtleggVedleggServer } from "../../services/bildeRegistrering";
import { useOpplastingsKo } from "../../providers/OpplastingsKoProvider";
import { AUTH_CONFIG } from "../../config/auth";
import { trpc } from "../../lib/trpc";
import type { UtleggRad, Utleggskategori } from "../../types/timer-detalj";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";

/**
 * UtleggSeksjon (U4) — registrering av utlegg/fakturert på mobil, mockup 8c.
 * Speiler TilleggSeksjon, men bærer utleggs-semantikken:
 *  - Ordningen er UTLEDET (utledOrdningLokalt), aldri valgt av feltarbeideren.
 *  - `utlegg`: beløp + PÅKREVD kvittering (kamera-primær, beløp før bilde,
 *    Lagre gated på bildet). `fakturert`: ren avhuking, «dekket av firma»,
 *    ingen beløp. `sats` bæres av SheetTillegg → vises ikke her.
 *  - Raden stemples med `ordningVedFoering` (immutabelt) + `foertVed` ved
 *    føring — offline, uten server. Serveren re-utleder aldri ved sync.
 */
interface UtleggSeksjonProps {
  sheetId: string;
  organizationId: string;
  projectId: string;
  rader: UtleggRad[];
  redigerbar: boolean;
  onEndret: () => void;
}

/** Pille-tekst per ordning (undertekst, aldri et valg). */
function ordningPilleTekst(ordning: UtleggOrdning, t: (k: string) => string): string {
  return ordning === "fakturert"
    ? t("timer.utlegg.ordning.fakturert")
    : t("timer.utlegg.ordning.utlegg");
}

function OrdningPille({ ordning }: { ordning: UtleggOrdning }) {
  const { t } = useTranslation();
  return (
    <View className="rounded bg-teal-50 px-1.5 py-0.5">
      <Text className="text-[10px] font-bold text-teal-700">
        {ordningPilleTekst(ordning, t)}
      </Text>
    </View>
  );
}

export function UtleggSeksjon({
  sheetId,
  organizationId,
  projectId,
  rader,
  redigerbar,
  onEndret,
}: UtleggSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);

  const oppdater = useCallback(
    (radId: string, belop: number | null, kommentar: string | null) => {
      const db = hentDatabase();
      if (!db) return;
      // Kun beløp (innenfor radens ordning) + kommentar er redigerbart —
      // kategori og ordningVedFoering er IMMUTABLE (som server oppdaterUtleggRad).
      db.update(sheetUtleggLocal)
        .set({ belop, kommentar, sistEndretLokalt: Date.now() })
        .where(eq(sheetUtleggLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      // S-A: slett lokalt + skriv tombstone ATOMISK (samme tx) — som tillegg.
      db.transaction((tx) => {
        tx.delete(sheetUtleggLocal).where(eq(sheetUtleggLocal.id, radId)).run();
        tx.insert(slettedeRaderLocal)
          .values({
            radId,
            dagsseddelId: sheetId,
            radType: "utlegg",
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
    <View className="mt-4">
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t("timer.kol.utlegg")}
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
      {rader.length === 0 ? (
        <View className="bg-white px-4 py-6">
          <Text className="text-center text-sm text-gray-400">
            {t("timer.ingenUtleggRader")}
          </Text>
        </View>
      ) : (
        rader.map((rad) => (
          <UtleggRadVis
            key={rad.id}
            rad={rad}
            redigerbar={redigerbar}
            onRediger={() => {
              setRedigerRadId(rad.id);
              setVisModal(true);
            }}
            onSlett={() => fjern(rad.id)}
          />
        ))
      )}

      {visModal && (
        <UtleggRadModal
          eksisterendeRad={
            redigerRadId ? rader.find((r) => r.id === redigerRadId) ?? null : null
          }
          organizationId={organizationId}
          projectId={projectId}
          sheetId={sheetId}
          onLagreEndring={(belop, kommentar) => {
            if (redigerRadId) oppdater(redigerRadId, belop, kommentar);
            setVisModal(false);
            setRedigerRadId(null);
            onEndret();
          }}
          onOpprettet={() => {
            setVisModal(false);
            setRedigerRadId(null);
            onEndret();
          }}
          onLukk={() => {
            setVisModal(false);
            setRedigerRadId(null);
          }}
        />
      )}
    </View>
  );
}

function UtleggRadVis({
  rad,
  redigerbar,
  onRediger,
  onSlett,
}: {
  rad: UtleggRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const ordning = (rad.ordningVedFoering as UtleggOrdning) ?? "utlegg";
  const kategori = useMemo(
    () => finnUtleggskategoriLokalt(rad.expenseCategoryId),
    [rad.expenseCategoryId],
  );
  const antallVedlegg = useMemo(() => {
    const db = hentDatabase();
    if (!db) return 0;
    return db
      .select()
      .from(sheetUtleggVedleggLocal)
      .where(eq(sheetUtleggVedleggLocal.sheetUtleggId, rad.id))
      .all().length;
  }, [rad.id]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base text-gray-900">
            {kategori?.navn ?? rad.expenseCategoryId}
          </Text>
          <OrdningPille ordning={ordning} />
        </View>
        {rad.kommentar && (
          <Text className="text-xs text-gray-500">{rad.kommentar}</Text>
        )}
        {antallVedlegg > 0 && (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Camera size={11} color="#9ca3af" />
            <Text className="text-xs text-gray-500">{antallVedlegg}</Text>
          </View>
        )}
      </View>
      {ordning === "fakturert" ? (
        <Text className="text-xs text-gray-500">
          {t("timer.utlegg.ordning.fakturert")}
        </Text>
      ) : (
        <Text className="font-mono text-base text-gray-900">
          {(rad.belop ?? 0).toFixed(2)}
        </Text>
      )}
      {redigerbar && (
        <View className="flex-row gap-1">
          <Pressable onPress={onRediger} hitSlop={8} className="rounded p-1.5 active:bg-gray-100">
            <Pencil size={16} color="#6b7280" />
          </Pressable>
          <Pressable onPress={onSlett} hitSlop={8} className="rounded p-1.5 active:bg-red-50">
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

type LokaltUtleggVedlegg = typeof sheetUtleggVedleggLocal.$inferSelect;

/** Én kvittering-miniatyr (speil av tillegg-VedleggBilde, signerUtleggVedlegg). */
function UtleggVedleggBilde({
  v,
  redigerbar,
  onFjern,
}: {
  v: LokaltUtleggVedlegg;
  redigerbar: boolean;
  onFjern: (v: LokaltUtleggVedlegg) => void;
}) {
  const { t } = useTranslation();
  const harLokal = !!v.lokalSti;
  const signert = trpc.timer.dagsseddel.signerUtleggVedlegg.useQuery(
    { vedleggId: v.id },
    { enabled: !harLokal && !!v.serverUrl },
  );
  const uri = harLokal
    ? v.lokalSti ?? undefined
    : signert.data?.url
      ? `${AUTH_CONFIG.apiUrl}${signert.data.url}`
      : undefined;

  return (
    <View className="relative">
      {uri && <Image source={{ uri }} className="h-20 w-20 rounded-lg bg-gray-100" />}
      {!v.serverUrl && (
        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center gap-1 rounded-b-lg bg-black/50 py-0.5">
          <Clock size={10} color="#ffffff" />
          <Text className="text-[10px] text-white">
            {t("timer.vedlegg.venterOpplasting")}
          </Text>
        </View>
      )}
      {redigerbar && (
        <Pressable
          onPress={() => onFjern(v)}
          hitSlop={8}
          className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1"
        >
          <X size={12} color="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Kvittering-håndtering på en LAGRET utlegg-rad (redigerings-modus). For
 * NYE rader tas bildet før lagring (kamera-primær, se UtleggRadModal). Speil
 * av tillegg-VedleggSeksjon.
 */
function UtleggVedleggSeksjon({
  sheetUtleggId,
  redigerbar,
  paakrevd,
}: {
  sheetUtleggId: string;
  redigerbar: boolean;
  paakrevd: boolean;
}) {
  const { t } = useTranslation();
  const { leggIKo, registrerUtleggVedleggCallback } = useOpplastingsKo();
  const [refreshKey, setRefreshKey] = useState(0);
  const [arbeider, setArbeider] = useState(false);

  const vedlegg = useMemo<LokaltUtleggVedlegg[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(sheetUtleggVedleggLocal)
      .where(eq(sheetUtleggVedleggLocal.sheetUtleggId, sheetUtleggId))
      .all();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUtleggId, refreshKey]);

  useEffect(
    () => registrerUtleggVedleggCallback(() => setRefreshKey((k) => k + 1)),
    [registrerUtleggVedleggCallback],
  );

  const leggVed = useCallback(
    async (kilde: "kamera" | "galleri") => {
      setArbeider(true);
      try {
        const res = kilde === "kamera" ? await taBilde() : await velgBilde();
        if (!res) return;
        const db = hentDatabase();
        if (!db) return;
        const vedleggId = randomUUID();
        const filnavn = `kvittering-${vedleggId}.jpg`;
        const lokalSti = await lagreLokaltBilde(res.uri, filnavn);
        db.insert(sheetUtleggVedleggLocal)
          .values({
            id: vedleggId,
            sheetUtleggId,
            lokalSti,
            serverUrl: null,
            filnavn,
            mimeType: "image/jpeg",
            filstorrelse: res.filstorrelse,
            sistEndretLokalt: Date.now(),
          })
          .run();
        await leggIKo({
          sheetUtleggId,
          objektId: sheetUtleggId,
          vedleggId,
          lokalSti,
          filnavn,
          mimeType: "image/jpeg",
          filstorrelse: res.filstorrelse,
          gpsLat: res.gpsLat,
          gpsLng: res.gpsLng,
          gpsAktivert: true,
        });
        setRefreshKey((k) => k + 1);
      } finally {
        setArbeider(false);
      }
    },
    [sheetUtleggId, leggIKo],
  );

  const fjern = useCallback(async (v: LokaltUtleggVedlegg) => {
    const db = hentDatabase();
    if (!db) return;
    db.delete(sheetUtleggVedleggLocal).where(eq(sheetUtleggVedleggLocal.id, v.id)).run();
    if (v.lokalSti) await slettLokaltBilde(v.lokalSti);
    if (v.serverUrl) fjernUtleggVedleggServer(v.id).catch(() => {});
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-gray-700">
        {t("timer.vedlegg.tittel")}
        {paakrevd ? " *" : ""}
      </Text>
      {vedlegg.length === 0 ? (
        <Text className="mb-2 text-xs text-gray-400">{t("timer.vedlegg.ingen")}</Text>
      ) : (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {vedlegg.map((v) => (
            <UtleggVedleggBilde key={v.id} v={v} redigerbar={redigerbar} onFjern={fjern} />
          ))}
        </View>
      )}
      {redigerbar && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => leggVed("kamera")}
            disabled={arbeider}
            className="flex-1 flex-row items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
            style={{ minHeight: 44 }}
          >
            <Camera size={18} color="#1e40af" />
            <Text className="text-sm font-medium text-gray-600">
              {t("timer.utlegg.taBilde")}
            </Text>
          </Pressable>
          {/* Galleri-vei: skjermbilde av digital kvittering (Vipps/e-post) uten
              kamera. Samme velgBilde-pipeline (komprimering + GPS + HEIC→jpg). */}
          <Pressable
            onPress={() => leggVed("galleri")}
            disabled={arbeider}
            accessibilityLabel={t("timer.utlegg.velgFraBilder")}
            className="items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-4 active:bg-gray-50"
            style={{ minHeight: 44 }}
          >
            <ImagePlus size={18} color="#1e40af" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function UtleggRadModal({
  eksisterendeRad,
  organizationId,
  projectId,
  sheetId,
  onLagreEndring,
  onOpprettet,
  onLukk,
}: {
  eksisterendeRad: UtleggRad | null;
  organizationId: string;
  projectId: string;
  sheetId: string;
  onLagreEndring: (belop: number | null, kommentar: string | null) => void;
  onOpprettet: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { leggIKo } = useOpplastingsKo();
  const erRedigering = !!eksisterendeRad;

  // Ny rad: id stemples ved åpning (stabil for pending-kvittering før lagring).
  const [nyRadId] = useState(() => randomUUID());
  const [valgtKategoriId, setValgtKategoriId] = useState<string>(
    eksisterendeRad?.expenseCategoryId ?? "",
  );
  const [belop, setBelop] = useState<string>(
    eksisterendeRad?.belop != null ? eksisterendeRad.belop.toFixed(2) : "",
  );
  const [kommentar, setKommentar] = useState<string>(eksisterendeRad?.kommentar ?? "");
  const [feil, setFeil] = useState<string | null>(null);
  const [visVelger, setVisVelger] = useState(false);
  const [arbeider, setArbeider] = useState(false);

  // Pending kvittering (kun ny rad) — bilde tas FØR lagring (kamera-primær).
  const [pendingFoto, setPendingFoto] = useState<{
    lokalSti: string;
    filnavn: string;
    filstorrelse?: number;
    gpsLat?: number;
    gpsLng?: number;
  } | null>(null);

  // Ordning: for eksisterende rad er den IMMUTABEL (radens stempel). For ny rad
  // utledes den on-device fra prosjekt + kategori (aldri valgt).
  const ordningOgKilde = useMemo(() => {
    if (erRedigering) {
      return {
        ordning: (eksisterendeRad!.ordningVedFoering as UtleggOrdning) ?? "utlegg",
        kilde: "firma-standard" as const,
      };
    }
    if (!valgtKategoriId) return null;
    return utledOrdningOgKildeLokalt(projectId, valgtKategoriId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erRedigering, valgtKategoriId, projectId]);

  const ordning: UtleggOrdning | null = ordningOgKilde?.ordning ?? null;
  const kategori = useMemo(
    () => (valgtKategoriId ? finnUtleggskategoriLokalt(valgtKategoriId) : null),
    [valgtKategoriId],
  );

  async function taKvittering(kilde: "kamera" | "galleri") {
    setArbeider(true);
    try {
      const res = kilde === "kamera" ? await taBilde() : await velgBilde();
      if (!res) return;
      // Erstatt evt. tidligere pending-bilde (rydd den gamle lokale fila).
      if (pendingFoto?.lokalSti) await slettLokaltBilde(pendingFoto.lokalSti);
      const filnavn = `kvittering-${randomUUID()}.jpg`;
      const lokalSti = await lagreLokaltBilde(res.uri, filnavn);
      setPendingFoto({
        lokalSti,
        filnavn,
        filstorrelse: res.filstorrelse,
        gpsLat: res.gpsLat,
        gpsLng: res.gpsLng,
      });
    } finally {
      setArbeider(false);
    }
  }

  async function lukkOgRyddPending() {
    // Forkast: rydd pending-bildet så det ikke blir foreldreløst.
    if (pendingFoto?.lokalSti) await slettLokaltBilde(pendingFoto.lokalSti);
    onLukk();
  }

  function parseBelop(): number | null {
    const tall = parseFloat(belop.replace(",", "."));
    return isNaN(tall) ? null : tall;
  }

  // Lagre-gate (ny rad): utlegg krever beløp > 0 OG et pending kvitteringsbilde.
  const belopTall = parseBelop();
  const lagreGatetAv = useMemo<string | null>(() => {
    if (erRedigering) {
      if (ordning && krevesBelop(ordning) && (!belopTall || belopTall <= 0)) {
        return t("timer.feil.belopPaakrevd");
      }
      return null;
    }
    if (!valgtKategoriId || !ordning) return t("timer.feil.kategoriPaakrevd");
    if (krevesBelop(ordning) && (!belopTall || belopTall <= 0)) {
      return t("timer.feil.belopPaakrevd");
    }
    if (kreverKvittering(ordning) && !pendingFoto) {
      return t("timer.feil.kvitteringPaakrevd");
    }
    return null;
  }, [erRedigering, valgtKategoriId, ordning, belopTall, pendingFoto, t]);

  async function lagre() {
    setFeil(null);
    if (lagreGatetAv) {
      setFeil(lagreGatetAv);
      return;
    }
    const db = hentDatabase();
    if (!db) return;

    // Redigering: kun beløp + kommentar (ordning/kategori immutabel).
    if (erRedigering) {
      const belopVerdi = ordning && krevesBelop(ordning) ? belopTall : null;
      onLagreEndring(belopVerdi, kommentar.trim() || null);
      return;
    }

    // Ny rad: stemple ordning + foertVed ved føring (offline, uten server).
    if (!ordning) return;
    const belopVerdi = krevesBelop(ordning) ? belopTall : null;
    const foertVed = Date.now();
    db.insert(sheetUtleggLocal)
      .values({
        id: nyRadId,
        dagsseddelId: sheetId,
        projectId,
        expenseCategoryId: valgtKategoriId,
        belop: belopVerdi,
        kommentar: kommentar.trim() || null,
        ordningVedFoering: ordning,
        foertVed,
        sistEndretLokalt: foertVed,
      })
      .run();

    // Kvittering: persistér + enqueue ETTER at raden finnes (server-row-orden).
    if (pendingFoto) {
      const vedleggId = randomUUID();
      db.insert(sheetUtleggVedleggLocal)
        .values({
          id: vedleggId,
          sheetUtleggId: nyRadId,
          lokalSti: pendingFoto.lokalSti,
          serverUrl: null,
          filnavn: pendingFoto.filnavn,
          mimeType: "image/jpeg",
          filstorrelse: pendingFoto.filstorrelse,
          sistEndretLokalt: foertVed,
        })
        .run();
      await leggIKo({
        sheetUtleggId: nyRadId,
        objektId: nyRadId,
        vedleggId,
        lokalSti: pendingFoto.lokalSti,
        filnavn: pendingFoto.filnavn,
        mimeType: "image/jpeg",
        filstorrelse: pendingFoto.filstorrelse,
        gpsLat: pendingFoto.gpsLat,
        gpsLng: pendingFoto.gpsLng,
        gpsAktivert: true,
      });
    }
    onOpprettet();
  }

  const visBelopFelt = ordning ? krevesBelop(ordning) : false;
  const visKamera = ordning ? baeresAvSheetUtlegg(ordning) : false;

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={lukkOgRyddPending}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {erRedigering ? t("timer.rediger.utlegg") : t("timer.tilfoy.utlegg")}
          </Text>
          <Pressable onPress={lukkOgRyddPending} hitSlop={12}>
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
            {/* Kategori — velges (ordning følger av den, aldri valgt separat). */}
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">
                {t("timer.felt.utleggskategori")} *
              </Text>
              {erRedigering ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                  <Text className="flex-1 text-base text-gray-900">
                    {kategori?.navn ?? eksisterendeRad!.expenseCategoryId}
                  </Text>
                  {ordning && <OrdningPille ordning={ordning} />}
                </View>
              ) : (
                <Pressable
                  onPress={() => setVisVelger(true)}
                  className="flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3"
                  style={{ minHeight: 44 }}
                >
                  <Text
                    className={`flex-1 text-base ${valgtKategoriId ? "text-gray-900" : "text-gray-400"}`}
                  >
                    {kategori?.navn ?? t("timer.velgUtleggskategori")}
                  </Text>
                  {ordning && <OrdningPille ordning={ordning} />}
                </Pressable>
              )}
              {/* Kilde-linje (8b): «firma-standard» / «overstyrt for prosjektet». */}
              {ordningOgKilde && !erRedigering && (
                <Text className="mt-1 text-xs text-gray-400">
                  {ordningOgKilde.kilde === "overstyrt"
                    ? t("timer.utlegg.kilde.overstyrt")
                    : t("timer.utlegg.kilde.firmaStandard")}
                </Text>
              )}
              {erRedigering && (
                <Text className="mt-1 text-xs text-gray-400">
                  {t("timer.utlegg.immutabel")}
                </Text>
              )}
            </View>

            {/* Beløp FØR bilde (bevisst rekkefølge, mockup 8c). Kun for utlegg. */}
            {visBelopFelt && (
              <View>
                <Text className="mb-1 text-sm font-medium text-gray-700">
                  {t("timer.felt.belop")} *
                </Text>
                <TextInput
                  value={belop}
                  onChangeText={setBelop}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={TASTATUR_FERDIG_ID}
                  placeholder="0,00"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-lg font-bold text-gray-900"
                />
              </View>
            )}

            {/* Fakturert: ingen beløp — «dekket av firma». */}
            {ordning === "fakturert" && (
              <View className="rounded-lg bg-gray-50 px-3 py-3">
                <Text className="text-sm text-gray-600">
                  {t("timer.utlegg.dekketAvFirma")}
                </Text>
              </View>
            )}

            {/* Kamera — primær på mobil. Ny rad: pending-bilde før lagring.
                Eksisterende rad: full vedlegg-håndtering. */}
            {visKamera &&
              (erRedigering ? (
                <UtleggVedleggSeksjon
                  sheetUtleggId={eksisterendeRad!.id}
                  redigerbar={true}
                  paakrevd={!!ordning && kreverKvittering(ordning)}
                />
              ) : (
                <View>
                  <Text className="mb-1 text-sm font-medium text-gray-700">
                    {t("timer.vedlegg.tittel")}
                    {ordning && kreverKvittering(ordning) ? " *" : ""}
                  </Text>
                  {pendingFoto ? (
                    <View className="relative self-start">
                      <Image
                        source={{ uri: pendingFoto.lokalSti }}
                        className="h-24 w-24 rounded-lg bg-gray-100"
                      />
                      <Pressable
                        onPress={async () => {
                          if (pendingFoto.lokalSti) await slettLokaltBilde(pendingFoto.lokalSti);
                          setPendingFoto(null);
                        }}
                        hitSlop={8}
                        className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1"
                      >
                        <X size={12} color="#ffffff" />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => taKvittering("kamera")}
                        disabled={arbeider}
                        className="flex-1 flex-row items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
                        style={{ minHeight: 44 }}
                      >
                        <Camera size={18} color="#1e40af" />
                        <Text className="text-sm font-medium text-gray-600">
                          {t("timer.utlegg.taBilde")}
                        </Text>
                      </Pressable>
                      {/* Galleri-vei (ny rad): digital kvittering som skjermbilde.
                          Samme velgBilde-pipeline (komprimering + GPS + HEIC→jpg). */}
                      <Pressable
                        onPress={() => taKvittering("galleri")}
                        disabled={arbeider}
                        accessibilityLabel={t("timer.utlegg.velgFraBilder")}
                        className="items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-4 active:bg-gray-50"
                        style={{ minHeight: 44 }}
                      >
                        <ImagePlus size={18} color="#1e40af" />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

            {/* Kommentar (valgfritt). */}
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">
                {t("timer.felt.kommentar")}
              </Text>
              <TextInput
                value={kommentar}
                onChangeText={setKommentar}
                multiline
                numberOfLines={3}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
                style={{ textAlignVertical: "top", minHeight: 80 }}
              />
            </View>

            {feil && <Text className="text-sm text-red-600">{feil}</Text>}

            <Pressable
              onPress={lagre}
              disabled={!!lagreGatetAv || arbeider}
              className={`mt-4 items-center rounded-lg px-6 py-4 ${
                lagreGatetAv || arbeider ? "bg-gray-300" : "bg-blue-600 active:bg-blue-700"
              }`}
              style={{ minHeight: 44 }}
            >
              <Text className="text-base font-semibold text-white">
                {t("handling.lagre")}
              </Text>
            </Pressable>
            {/* Gate-forklaring (mockup 8c): «Lagre aktiveres når bildet er tatt». */}
            {!erRedigering && ordning && kreverKvittering(ordning) && !pendingFoto && (
              <Text className="text-center text-xs text-gray-400">
                {t("timer.utlegg.kvitteringPaakrevd")}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <TastaturFerdig />

        {visVelger && (
          <UtleggVelgerModal
            organizationId={organizationId}
            projectId={projectId}
            valgtId={valgtKategoriId}
            onVelg={(id) => {
              setValgtKategoriId(id);
              setVisVelger(false);
            }}
            onLukk={() => setVisVelger(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function UtleggVelgerModal({
  organizationId,
  projectId,
  valgtId,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  projectId: string;
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  // Kategorier med UTLEDET ordning for DETTE prosjektet. Kun `utlegg` tilbys på
  // mobil: `lonnstillegg` (tidl. `sats`) bæres av SheetTillegg (lønnstillegg-
  // seksjonen), og `fakturert` er ikke lenger valgbar (modelljustering 2026-08-11).
  const kategorier = useMemo(() => {
    return hentUtleggskategorierLokalt(organizationId)
      .map((k: Utleggskategori) => ({
        kategori: k,
        ordning: utledOrdningLokalt(projectId, k.id),
      }))
      .filter(
        (r): r is { kategori: Utleggskategori; ordning: UtleggOrdning } =>
          r.ordning === "utlegg",
      );
  }, [organizationId, projectId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return kategorier;
    const q = sok.toLowerCase();
    return kategorier.filter((r) => r.kategori.navn.toLowerCase().includes(q));
  }, [kategorier, sok]);

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
            {t("timer.velgUtleggskategori")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {kategorier.length > 7 && (
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
          keyExtractor={(item) => item.kategori.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.kategori.id)}
              className={`flex-row items-center gap-2 border-b border-gray-100 px-4 py-3 ${
                item.kategori.id === valgtId ? "bg-blue-50" : ""
              }`}
              style={{ minHeight: 44 }}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.kategori.navn}</Text>
              </View>
              <OrdningPille ordning={item.ordning} />
              {item.kategori.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.utlegg.ingenKategorier")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
