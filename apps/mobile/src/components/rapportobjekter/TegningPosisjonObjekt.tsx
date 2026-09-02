import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Target, X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";
import { harTegningsmarkor, type TegningPosisjonVerdi } from "@sitedoc/shared";
import { trpc } from "../../lib/trpc";
import { AUTH_CONFIG } from "../../config/auth";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import { useByggeplass } from "../../kontekst/ByggeplassKontekst";
import { TegningsVisning, type Markør } from "../TegningsVisning";
import { TegningsVelger } from "../TegningsVelger";

// Minimale former (unngår TS2589 fra dype tRPC-typer, samme mønster som lokasjoner.tsx).
interface BygningData {
  id: string;
  name: string;
  status: string;
  type?: string;
}
interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  byggeplassId: string | null;
  fileUrl: string | null;
  geoReference?: unknown;
  _count: { revisions: number };
}

/**
 * H8 (2026-08-24): mobil kan nå SETTE tegningsposisjon — tidligere en placeholder.
 * Modal med TegningsVelger (bygning→tegning) + TegningsVisning (tapp for å plassere markør).
 * Default-tegning: radens egen (`verdi.drawingId`) hvis satt, ellers per-byggeplass
 * siste-tegning-minne fra `ByggeplassKontekst` (samme kilde som OpprettDokumentModal),
 * ellers velgeren. Minnet er FORHÅNDSVALG, ikke låsing — «Bytt tegning» virker som før.
 * (Dokumentets tegning som mellomdefault krever en ny prop threadet fra detaljsiden — egen
 *  liten oppfølger; kjeden radens→dokumentets→full velger fullføres da.)
 */
export function TegningPosisjonObjekt({
  verdi,
  onEndreVerdi,
  leseModus,
  arvetDrawingId,
}: RapportObjektProps) {
  const { t } = useTranslation();
  // Prosjekt-id fra KONTEKST, ikke `prosjektId`-propen — den threades ikke ned til felt
  // (rendereren sender den ikke), så propen var undefined → query disabled → 0 tegninger.
  // Samme kilde som TegningsSkjermbilde/FeltDokumentasjon bruker.
  const { valgtProsjektId } = useProsjekt();
  // Per-byggeplass siste-tegning-minne (felles kontekst, IKKE en egen implementasjon).
  // Lesenøkkel = global aktiv byggeplass, som OpprettDokumentModal:221-223.
  const { valgtBygningId: kontekstBygningId, hentSistTegning, settSistTegning } = useByggeplass();
  const posisjon = verdi as TegningPosisjonVerdi | null;
  // useSafeAreaInsets måler riktig topp/bunn inne i presentationStyle="fullScreen";
  // <SafeAreaView edges> anvender 0 der (simulator-målt 2026-08-31), derfor padder vi
  // fra hooken på en vanlig View. Kun målt for DENNE modalen — se BACKLOG-spor.
  const insets = useSafeAreaInsets();
  const [modalÅpen, setModalÅpen] = useState(false);
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(posisjon?.drawingId ?? null);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(
    posisjon?.positionX != null && posisjon?.positionY != null
      ? { x: posisjon.positionX, y: posisjon.positionY }
      : null,
  );

  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: modalÅpen && !!valgtProsjektId },
  );
  // Hent ALLE prosjektets tegninger (som TegningsSkjermbilde); TegningsVelger filtrerer
  // client-side på valgt bygning. Ingen byggeplassId i queryen → ingen re-fetch ved bygningsbytte.
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: modalÅpen && !!valgtProsjektId },
  );
  const tegningDetaljQuery = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: modalÅpen && !!valgtTegningId },
  );

  const bygninger = (bygningQuery.data ?? []) as BygningData[];
  const tegninger = (tegningQuery.data ?? []) as TegningData[];
  const tegningDetalj = tegningDetaljQuery.data as { name: string; fileUrl: string | null } | undefined;

  // Forvalg kjøres én gang per modal-åpning, ETTER at tegningslista er lastet (queryen er
  // disabled til modalen åpnes). Ref-guard hindrer at et senere brukervalg overskrives.
  // Rangering (Kenneth-vedtak 2026-09-02): (a) radens egen tegning · (b) arv fra forrige
  // repeater-rad · (c) per-byggeplass siste-tegning-minne. Alle er FORHÅNDSVALG — «Bytt
  // tegning» virker uansett. (Dokumentets tegning som mellomnivå er en navngitt oppfølger.)
  const harForvalgt = useRef(false);
  useEffect(() => {
    if (!modalÅpen || harForvalgt.current) return;
    // (a) Rediger vinner: en rad som alt har en tegning bruker sin egen (satt i åpne()).
    if (posisjon?.drawingId) {
      harForvalgt.current = true;
      return;
    }
    // Vent til lista er lastet så vi kan VALIDERE forhåndsvalgene mot den.
    if (tegningQuery.isLoading) return;
    // (b) Arv fra forrige repeater-rad — validert mot lista (slettet/annet prosjekt → hopp).
    if (arvetDrawingId && tegninger.some((t) => t.id === arvetDrawingId)) {
      harForvalgt.current = true;
      setValgtTegningId(arvetDrawingId);
      return;
    }
    // (c) Per-byggeplass siste-tegning-minne. Uten byggeplass i konteksten finnes ingen
    // lesenøkkel → vent (byggeplass kan komme senere); fall ellers til velgeren.
    if (!kontekstBygningId) return;
    harForvalgt.current = true;
    const lagretTegningId = hentSistTegning(kontekstBygningId);
    if (!lagretTegningId) return;
    if (!tegninger.some((t) => t.id === lagretTegningId)) return;
    setValgtTegningId(lagretTegningId);
  }, [
    modalÅpen,
    tegningQuery.isLoading,
    tegninger,
    kontekstBygningId,
    posisjon?.drawingId,
    arvetDrawingId,
    hentSistTegning,
  ]);

  function åpne() {
    harForvalgt.current = false;
    setValgtTegningId(posisjon?.drawingId ?? null);
    setValgtBygningId(null);
    setTempPos(
      posisjon?.positionX != null && posisjon?.positionY != null
        ? { x: posisjon.positionX, y: posisjon.positionY }
        : null,
    );
    setModalÅpen(true);
  }

  function bekreft() {
    if (valgtTegningId && tempPos && tegningDetalj) {
      onEndreVerdi({
        drawingId: valgtTegningId,
        positionX: tempPos.x,
        positionY: tempPos.y,
        drawingName: tegningDetalj.name,
      } as TegningPosisjonVerdi);
      // Husk siste tegning per byggeplass i felles kontekst — nøkkel = tegningens
      // egen byggeplass (som OpprettDokumentModal:475), så minnet er symmetrisk
      // mellom de to flatene. Fall til global kontekst hvis tegningen mangler den.
      const bp = tegninger.find((t) => t.id === valgtTegningId)?.byggeplassId ?? kontekstBygningId;
      if (bp) settSistTegning(bp, valgtTegningId);
    }
    setModalÅpen(false);
  }

  const markører: Markør[] = tempPos
    ? [{ id: "ny", x: tempPos.x, y: tempPos.y, farge: "#10b981", fylt: true }]
    : [];
  const tegningUrl = tegningDetalj?.fileUrl
    ? tegningDetalj.fileUrl.startsWith("http")
      ? tegningDetalj.fileUrl
      : `${AUTH_CONFIG.apiUrl}${tegningDetalj.fileUrl}`
    : null;

  // Komplett markør (tegning + punkt)? Delt paritetsregel med web/PDF.
  const harMarkor = harTegningsmarkor(posisjon);

  // Visning av lagret posisjon (les + rediger deler samme oppsummering). Posisjon-linja
  // rendres KUN med komplett markør — ellers er positionX/Y null (og `.toFixed` krasjer;
  // funn 2026-09-02: mobil lesevisning krasjet i dag når punkt manglet).
  const oppsummering = posisjon ? (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Target size={16} color="#6b7280" />
        <Text className="flex-1 text-sm text-gray-700">{posisjon.drawingName}</Text>
        {!leseModus && (
          <Pressable onPress={() => onEndreVerdi(null)} className="rounded-full bg-gray-100 p-1">
            <X size={14} color="#6b7280" />
          </Pressable>
        )}
      </View>
      {harMarkor && (
        <Text className="text-xs text-gray-500">
          {t("felt.posisjonXY", { x: posisjon.positionX.toFixed(1), y: posisjon.positionY.toFixed(1) })}
        </Text>
      )}
    </View>
  ) : null;

  if (leseModus) {
    // Paritetsregel (2026-09-02): lesevisning følger PDF-ens harMarkor. Tegning uten
    // punkt er en arbeidstilstand → vis som «ingen lokasjon», ikke en halv oppsummering.
    return harMarkor ? oppsummering : (
      <Text className="text-sm italic text-gray-400">{t("felt.ingenPosisjon")}</Text>
    );
  }

  return (
    <View className="gap-3">
      {posisjon ? (
        <View className="gap-2">
          {oppsummering}
          <Pressable onPress={åpne} className="self-start rounded-lg bg-gray-100 px-3 py-1.5">
            <Text className="text-xs font-medium text-gray-700">{t("felt.endrePosisjon")}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={åpne}
          className="items-center rounded-lg border border-dashed border-gray-300 px-4 py-6"
        >
          <Target size={24} color="#9ca3af" />
          <Text className="mt-2 text-sm text-gray-600">{t("felt.velgTegningMarker")}</Text>
        </Pressable>
      )}

      {/* fullScreen + conditional content: WebView-en (TegningsVisning) må UNMOUNTES når modalen
          lukkes, ellers blir skjermen svart (samme mønster som FeltDokumentasjons skjermbilde-modal). */}
      <Modal
        visible={modalÅpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalÅpen(false)}
      >
        {modalÅpen ? (
        <View className="flex-1 bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
            <Pressable onPress={() => setModalÅpen(false)} hitSlop={12}>
              <X size={22} color="#374151" />
            </Pressable>
            <Text className="text-sm font-semibold text-gray-900">{t("felt.markerPosisjon")}</Text>
            <Pressable
              onPress={bekreft}
              disabled={!valgtTegningId || !tempPos}
              hitSlop={12}
              className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${valgtTegningId && tempPos ? "bg-green-600" : "bg-gray-200"}`}
            >
              <Check size={14} color={valgtTegningId && tempPos ? "#ffffff" : "#9ca3af"} />
              <Text className={`text-xs font-medium ${valgtTegningId && tempPos ? "text-white" : "text-gray-400"}`}>
                {t("handling.bekreft")}
              </Text>
            </Pressable>
          </View>

          {/* Deaktivert knapp skal si hva som mangler (ui-standarder). «Bekreft» er grå til
              en markør er plassert — si det, ellers leses gråtonen som en feil. Forsvinner
              idet tempPos settes (og knappen blir aktiv). */}
          {valgtTegningId && !tempPos ? (
            <View className="border-b border-gray-100 bg-amber-50 px-4 py-2">
              <Text className="text-xs text-amber-700">
                {t("felt.trykkForAaPlassere")}
              </Text>
            </View>
          ) : null}

          {valgtTegningId && tegningUrl ? (
            <View className="flex-1">
              {/* Indre X (TegningsVisnings header) lukker HELE modalen — samme som ytre X.
                  «Bytt tegning» nedenfor er eneste vei tilbake til tegningslista. To identiske
                  X-er som gjorde forskjellige ting var selve fella (prod-bygg 46). */}
              <TegningsVisning
                tegningUrl={tegningUrl}
                tegningNavn={tegningDetalj?.name ?? ""}
                onLukk={() => setModalÅpen(false)}
                onTrykk={(x, y) => setTempPos({ x, y })}
                markører={markører}
              />
              {/* Bunnlinje-utgang: «Lukk» ligger langt fra Dynamic Island og hjemindikator —
                  robust utgang uavhengig av safe-area-insets (hovedfiks mot innelåsing). */}
              <View className="flex-row items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
                <Pressable onPress={() => { setValgtTegningId(null); setTempPos(null); }} hitSlop={8}>
                  <Text className="text-sm font-medium text-sitedoc-primary">{t("felt.byttTegning")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setModalÅpen(false)}
                  hitSlop={8}
                  className="rounded-full bg-gray-100 px-5 py-1.5"
                >
                  <Text className="text-sm font-medium text-gray-700">{t("handling.lukk")}</Text>
                </Pressable>
              </View>
            </View>
          ) : valgtTegningId && tegningDetaljQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#1e40af" />
            </View>
          ) : (
            <TegningsVelger
              bygninger={bygninger}
              tegninger={tegninger}
              valgtBygningId={valgtBygningId}
              valgtTegningId={valgtTegningId}
              onVelgBygning={(id) => setValgtBygningId(id)}
              onVelgTegning={(id) => { setValgtTegningId(id); setTempPos(null); }}
              onAvbryt={() => setModalÅpen(false)}
              laster={bygningQuery.isLoading || tegningQuery.isLoading}
            />
          )}
        </View>
        ) : null}
      </Modal>
    </View>
  );
}
