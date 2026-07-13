// P2 (arbeider-splitt, 2026-07): mobil splitt-modal. Porter web-SplittRadModal
// (apps/web/src/components/timer/SplittRadModal.tsx): del én redigerbar rad i
// N nye rader der summen av delene MÅ === originalens timer/antall.
//
// ARKITEKTUR: mobil er offline-first. syncBatch gjør deleteMany+createMany per
// sedel (full reconcile), så en splitt er en REN LOKAL Drizzle-operasjon — IKKE
// et tRPC-kall. På bekreft: slett original lokal rad + sett inn N nye lokale
// rader, og kall onLagret (som markerer sedelen pending + triggerSync via
// seksjonens onEndret). Insert-feltene speiler seksjonenes leggTil NØYAKTIG.

import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import {
  sheetTimerLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  lonnsartLocal,
  aktivitetLocal,
  equipmentLocal,
  externalCostObjectLocal,
} from "../../db/schema";
import type { TimerRad, MaskinRad, TilleggRad } from "../../types/timer-detalj";
import { VelgerFelt } from "./VelgerFelt";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import {
  LonnsartVelgerModal,
  AktivitetVelgerModal,
  UnderprosjektVelgerModal,
} from "./TimerSeksjon";
import { EquipmentVelgerModal, EnhetVelgerModal } from "./MaskinSeksjon";

type Props =
  | {
      radType: "timer";
      original: TimerRad;
      organizationId: string;
      onLukk: () => void;
      onLagret: () => void;
    }
  | {
      radType: "maskin";
      original: MaskinRad;
      organizationId: string;
      onLukk: () => void;
      onLagret: () => void;
    }
  | {
      radType: "tillegg";
      original: TilleggRad;
      organizationId: string;
      onLukk: () => void;
      onLagret: () => void;
    };

/** Intern del-modell — beløpet holdes som tekst for RN-desimaltasting. */
type TimerDel = {
  key: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timerTekst: string;
};
type MaskinDel = {
  key: string;
  vehicleId: string;
  externalCostObjectId: string | null;
  mengdeTekst: string;
  enhet: string | null;
  timerTekst: string;
};
type TilleggDel = {
  key: string;
  antallTekst: string;
};

function nyKey(): string {
  return `split-${Math.random().toString(36).slice(2, 11)}`;
}

function tilTall(tekst: string): number {
  const n = parseFloat(tekst.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/** Del `total` likt i `n` deler (2 desimaler). Siste del absorberer resten så
 *  summen alltid === total (unngår avrundingsdrift). */
function delLikt(total: number, n: number): string[] {
  const hver = Math.round((total / n) * 100) / 100;
  const deler: string[] = [];
  let rest = total;
  for (let i = 0; i < n - 1; i++) {
    deler.push(hver.toFixed(2));
    rest = Math.round((rest - hver) * 100) / 100;
  }
  deler.push(rest.toFixed(2));
  return deler;
}

export function SplittRadModal(props: Props) {
  const { t } = useTranslation();

  // Original-sum som delene må matche.
  const originalSum =
    props.radType === "tillegg"
      ? props.original.antall
      : props.original.timer;

  // ECO-velgeren trenger prosjekt-scope; timer/maskin arver original-prosjektet.
  const projectId =
    props.radType === "tillegg"
      ? props.original.projectId ?? ""
      : props.original.projectId ?? "";

  // Én useState per rad-type (radType er konstant i modalens levetid, men hooks
  // må kalles ubetinget) — kun den aktive listen brukes. Init = 2 deler likt.
  const [timerDeler, setTimerDeler] = useState<TimerDel[]>(() => {
    if (props.radType !== "timer") return [];
    const o = props.original;
    return delLikt(o.timer, 2).map((b) => ({
      key: nyKey(),
      lonnsartId: o.lonnsartId,
      aktivitetId: o.aktivitetId,
      externalCostObjectId: o.externalCostObjectId,
      timerTekst: b,
    }));
  });
  const [maskinDeler, setMaskinDeler] = useState<MaskinDel[]>(() => {
    if (props.radType !== "maskin") return [];
    const o = props.original;
    return delLikt(o.timer, 2).map((b) => ({
      key: nyKey(),
      vehicleId: o.vehicleId,
      externalCostObjectId: o.externalCostObjectId,
      mengdeTekst: "",
      enhet: o.enhet,
      timerTekst: b,
    }));
  });
  const [tilleggDeler, setTilleggDeler] = useState<TilleggDel[]>(() => {
    if (props.radType !== "tillegg") return [];
    const o = props.original;
    return delLikt(o.antall, 2).map((b) => ({ key: nyKey(), antallTekst: b }));
  });

  const [feil, setFeil] = useState<string | null>(null);

  const radTeller =
    props.radType === "timer"
      ? timerDeler.length
      : props.radType === "maskin"
        ? maskinDeler.length
        : tilleggDeler.length;

  const splitSum = useMemo(() => {
    if (props.radType === "timer")
      return timerDeler.reduce((a, d) => a + tilTall(d.timerTekst), 0);
    if (props.radType === "maskin")
      return maskinDeler.reduce((a, d) => a + tilTall(d.timerTekst), 0);
    return tilleggDeler.reduce((a, d) => a + tilTall(d.antallTekst), 0);
  }, [props.radType, timerDeler, maskinDeler, tilleggDeler]);

  const gjenstaar = originalSum - splitSum;
  const balansert = Math.abs(gjenstaar) < 0.001;

  function leggTilDel() {
    const rest = Math.max(0, gjenstaar);
    const restTekst = rest.toFixed(2);
    if (props.radType === "timer") {
      const o = props.original;
      setTimerDeler((deler) => [
        ...deler,
        {
          key: nyKey(),
          lonnsartId: o.lonnsartId,
          aktivitetId: o.aktivitetId,
          externalCostObjectId: o.externalCostObjectId,
          timerTekst: restTekst,
        },
      ]);
    } else if (props.radType === "maskin") {
      const o = props.original;
      setMaskinDeler((deler) => [
        ...deler,
        {
          key: nyKey(),
          vehicleId: o.vehicleId,
          externalCostObjectId: deler[deler.length - 1]?.externalCostObjectId ?? o.externalCostObjectId,
          mengdeTekst: "",
          enhet: o.enhet,
          timerTekst: restTekst,
        },
      ]);
    } else {
      setTilleggDeler((deler) => [
        ...deler,
        { key: nyKey(), antallTekst: restTekst },
      ]);
    }
  }

  function slettDel(key: string) {
    if (props.radType === "timer")
      setTimerDeler((d) => d.filter((r) => r.key !== key));
    else if (props.radType === "maskin")
      setMaskinDeler((d) => d.filter((r) => r.key !== key));
    else setTilleggDeler((d) => d.filter((r) => r.key !== key));
  }

  function oppdaterTimer(key: string, felt: Partial<TimerDel>) {
    setTimerDeler((d) => d.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }
  function oppdaterMaskin(key: string, felt: Partial<MaskinDel>) {
    setMaskinDeler((d) => d.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }
  function oppdaterTillegg(key: string, felt: Partial<TilleggDel>) {
    setTilleggDeler((d) => d.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }

  function handleLagre() {
    setFeil(null);
    if (radTeller < 2) {
      setFeil(t("timer.splitt.feil.minst2Rader"));
      return;
    }
    if (!balansert) {
      setFeil(t("timer.splitt.feil.sumIkkeMatch"));
      return;
    }
    const db = hentDatabase();
    if (!db) return;

    if (props.radType === "timer") {
      for (const d of timerDeler) {
        if (!d.lonnsartId || !d.aktivitetId || tilTall(d.timerTekst) <= 0) {
          setFeil(t("timer.rediger.feil.timerInkomplett"));
          return;
        }
      }
      const o = props.original;
      // Lokal reconcile: GJENBRUK originalens id på del 1 (update), insert resten.
      // Rasjonale (S3-fiks): syncBatch sletter kun rader hvis id er i payloaden
      // (deleteMany id:{in:...}). Sletter vi originalen lokalt faller id-en ut av
      // payloaden → server beholder originalen → duplikat (alltid på returnerte,
      // synkede sedler). Ved å beholde original-id-en på del 1 forblir den i
      // payloaden → server sletter+gjenoppretter samme id, ingen orphan.
      // Insert-feltene speiler TimerSeksjon.leggTil; prosjekt/fra/til/beskrivelse
      // arves (står allerede på originalen — kun lønnsart/aktivitet/ECO/timer varierer).
      const [forsteTimer, ...restenTimer] = timerDeler;
      db.update(sheetTimerLocal)
        .set({
          lonnsartId: forsteTimer.lonnsartId,
          aktivitetId: forsteTimer.aktivitetId,
          externalCostObjectId: forsteTimer.externalCostObjectId,
          timer: tilTall(forsteTimer.timerTekst),
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTimerLocal.id, o.id))
        .run();
      for (const d of restenTimer) {
        db.insert(sheetTimerLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: o.dagsseddelId,
            projectId: o.projectId,
            lonnsartId: d.lonnsartId,
            aktivitetId: d.aktivitetId,
            externalCostObjectId: d.externalCostObjectId,
            timer: tilTall(d.timerTekst),
            fraTid: o.fraTid,
            tilTid: o.tilTid,
            beskrivelse: o.beskrivelse,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
    } else if (props.radType === "maskin") {
      for (const d of maskinDeler) {
        if (!d.vehicleId || tilTall(d.timerTekst) <= 0) {
          setFeil(t("timer.rediger.feil.maskinInkomplett"));
          return;
        }
      }
      const o = props.original;
      // S3-fiks (som timer): GJENBRUK original-id på del 1 (update) + insert resten,
      // så original-id-en blir i syncBatch-payloaden og ikke etterlater en orphan.
      // Insert-feltene speiler MaskinSeksjon.leggTil; prosjekt/fra/til arves
      // (utstyr/mengde/enhet/ECO/timer varierer per del).
      const [forsteMaskin, ...restenMaskin] = maskinDeler;
      const forsteMengde = forsteMaskin.mengdeTekst.trim()
        ? tilTall(forsteMaskin.mengdeTekst)
        : null;
      db.update(sheetMachineLocal)
        .set({
          externalCostObjectId: forsteMaskin.externalCostObjectId,
          vehicleId: forsteMaskin.vehicleId,
          timer: tilTall(forsteMaskin.timerTekst),
          mengde: forsteMengde,
          enhet: forsteMaskin.enhet,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetMachineLocal.id, o.id))
        .run();
      for (const d of restenMaskin) {
        const mengdeNum = d.mengdeTekst.trim() ? tilTall(d.mengdeTekst) : null;
        db.insert(sheetMachineLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: o.dagsseddelId,
            projectId: o.projectId,
            externalCostObjectId: d.externalCostObjectId,
            vehicleId: d.vehicleId,
            timer: tilTall(d.timerTekst),
            mengde: mengdeNum,
            enhet: d.enhet,
            fraTid: o.fraTid,
            tilTid: o.tilTid,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
    } else {
      for (const d of tilleggDeler) {
        if (tilTall(d.antallTekst) <= 0) {
          setFeil(t("timer.rediger.feil.tilleggInkomplett"));
          return;
        }
      }
      const o = props.original;
      // S3-fiks (som timer/maskin): GJENBRUK original-id på del 1 (update) + insert
      // resten. Insert-feltene speiler TilleggSeksjon.leggTil; prosjekt/tillegg/
      // kommentar arves fra originalen (kun antall varierer per del).
      const [forsteTillegg, ...restenTillegg] = tilleggDeler;
      db.update(sheetTilleggLocal)
        .set({
          antall: tilTall(forsteTillegg.antallTekst),
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTilleggLocal.id, o.id))
        .run();
      for (const d of restenTillegg) {
        db.insert(sheetTilleggLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: o.dagsseddelId,
            projectId: o.projectId,
            tilleggId: o.tilleggId,
            antall: tilTall(d.antallTekst),
            kommentar: o.kommentar,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
    }
    props.onLagret();
  }

  const indikatorKlasse = balansert
    ? "border-green-200 bg-green-50"
    : gjenstaar < 0
      ? "border-red-200 bg-red-50"
      : "border-amber-200 bg-amber-50";
  const indikatorTekstKlasse = balansert
    ? "text-green-800"
    : gjenstaar < 0
      ? "text-red-800"
      : "text-amber-800";
  const indikatorTekst = balansert
    ? t("timer.splitt.balansert")
    : gjenstaar < 0
      ? t("timer.splitt.foredelt", { antall: Math.abs(gjenstaar).toFixed(2) })
      : t("timer.splitt.gjenstaar", { antall: gjenstaar.toFixed(2) });

  const enhetTekst =
    props.radType === "tillegg"
      ? t("timer.felt.antall")
      : t("timer.kol.timer");

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t(`timer.splitt.tittel.${props.radType}`)}
          </Text>
          <Pressable onPress={props.onLukk} hitSlop={12}>
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
            contentContainerClassName="p-4 gap-3"
            keyboardShouldPersistTaps="handled"
          >
            {/* Original-referanse */}
            <View className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("timer.splitt.original")}
              </Text>
              <Text className="mt-0.5 font-mono text-base text-gray-900">
                {originalSum.toFixed(2)} {enhetTekst}
              </Text>
            </View>

            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("timer.splitt.splitRader")} ({radTeller})
            </Text>

            {props.radType === "timer" &&
              timerDeler.map((del, i) => (
                <TimerDelRad
                  key={del.key}
                  del={del}
                  indeks={i}
                  projectId={projectId}
                  kanSlett={i > 0}
                  onChange={(felt) => oppdaterTimer(del.key, felt)}
                  onSlett={() => slettDel(del.key)}
                />
              ))}

            {props.radType === "maskin" &&
              maskinDeler.map((del, i) => (
                <MaskinDelRad
                  key={del.key}
                  del={del}
                  indeks={i}
                  organizationId={props.organizationId}
                  projectId={projectId}
                  kanSlett={i > 0}
                  onChange={(felt) => oppdaterMaskin(del.key, felt)}
                  onSlett={() => slettDel(del.key)}
                />
              ))}

            {props.radType === "tillegg" &&
              tilleggDeler.map((del, i) => (
                <TilleggDelRad
                  key={del.key}
                  del={del}
                  indeks={i}
                  kanSlett={i > 0}
                  onChange={(felt) => oppdaterTillegg(del.key, felt)}
                  onSlett={() => slettDel(del.key)}
                />
              ))}

            <Pressable
              onPress={leggTilDel}
              className="flex-row items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white py-2.5 active:bg-gray-50"
            >
              <Plus size={14} color="#1e40af" />
              <Text className="text-sm font-medium text-sitedoc-primary">
                {t("timer.splitt.leggTilRad")}
              </Text>
            </Pressable>

            {/* Gjenstår-indikator */}
            <View className={`rounded-lg border px-3 py-2.5 ${indikatorKlasse}`}>
              <Text className={`text-sm font-medium ${indikatorTekstKlasse}`}>
                {indikatorTekst}
              </Text>
            </View>

            {feil && <Text className="text-sm text-red-600">{feil}</Text>}

            <Pressable
              onPress={handleLagre}
              disabled={!balansert || radTeller < 2}
              className={`mt-2 items-center rounded-lg px-6 py-4 ${
                !balansert || radTeller < 2
                  ? "bg-gray-300"
                  : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  !balansert || radTeller < 2 ? "text-gray-500" : "text-white"
                }`}
              >
                {t("timer.splitt.lagre")}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
        <TastaturFerdig />
      </SafeAreaView>
    </Modal>
  );
}

// ---- Del-rader (per rad-type) ----

function DelHeader({
  indeks,
  kanSlett,
  onSlett,
}: {
  indeks: number;
  kanSlett: boolean;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("timer.splitt.del", { nr: indeks + 1 })}
      </Text>
      {kanSlett && (
        <Pressable
          onPress={onSlett}
          hitSlop={8}
          className="rounded p-1 active:bg-red-50"
        >
          <Trash2 size={16} color="#dc2626" />
        </Pressable>
      )}
    </View>
  );
}

function TimerDelRad({
  del,
  indeks,
  projectId,
  kanSlett,
  onChange,
  onSlett,
}: {
  del: TimerDel;
  indeks: number;
  projectId: string;
  kanSlett: boolean;
  onChange: (felt: Partial<TimerDel>) => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const [visLonnsart, setVisLonnsart] = useState(false);
  const [visAktivitet, setVisAktivitet] = useState(false);
  const [visEco, setVisEco] = useState(false);

  const lonnsart = useMemo(() => {
    if (!del.lonnsartId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(lonnsartLocal)
        .where(eq(lonnsartLocal.id, del.lonnsartId))
        .all()[0] ?? null
    );
  }, [del.lonnsartId]);

  const aktivitet = useMemo(() => {
    if (!del.aktivitetId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(aktivitetLocal)
        .where(eq(aktivitetLocal.id, del.aktivitetId))
        .all()[0] ?? null
    );
  }, [del.aktivitetId]);

  const eco = useMemo(() => {
    if (!del.externalCostObjectId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, del.externalCostObjectId))
        .all()[0] ?? null
    );
  }, [del.externalCostObjectId]);

  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <DelHeader indeks={indeks} kanSlett={kanSlett} onSlett={onSlett} />
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.lonnsart")} *
        </Text>
        <VelgerFelt
          verdi={lonnsart?.navn ?? null}
          placeholder={t("timer.velgLonnsart")}
          onPress={() => setVisLonnsart(true)}
        />
      </View>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.aktivitet")} *
        </Text>
        <VelgerFelt
          verdi={aktivitet?.navn ?? null}
          placeholder={t("timer.velgAktivitet")}
          onPress={() => setVisAktivitet(true)}
        />
      </View>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.underprosjekt")}
        </Text>
        <VelgerFelt
          verdi={eco ? `${eco.proAdmId} — ${eco.kortNavn}` : null}
          placeholder={t("timer.velgUnderprosjekt")}
          onPress={() => setVisEco(true)}
          onClear={() => onChange({ externalCostObjectId: null })}
        />
      </View>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.antallTimer")} *
        </Text>
        <TextInput
          value={del.timerTekst}
          onChangeText={(v) => onChange({ timerTekst: v })}
          placeholder="0,00"
          keyboardType="decimal-pad"
          inputAccessoryViewID={TASTATUR_FERDIG_ID}
          className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
        />
      </View>

      {visLonnsart && (
        <LonnsartVelgerModal
          valgtId={del.lonnsartId}
          onVelg={(id) => {
            onChange({ lonnsartId: id });
            setVisLonnsart(false);
          }}
          onLukk={() => setVisLonnsart(false)}
        />
      )}
      {visAktivitet && (
        <AktivitetVelgerModal
          valgtId={del.aktivitetId}
          onVelg={(id) => {
            onChange({ aktivitetId: id });
            setVisAktivitet(false);
          }}
          onLukk={() => setVisAktivitet(false)}
        />
      )}
      {visEco && (
        <UnderprosjektVelgerModal
          projectId={projectId}
          valgtId={del.externalCostObjectId}
          onVelg={(id) => {
            onChange({ externalCostObjectId: id });
            setVisEco(false);
          }}
          onLukk={() => setVisEco(false)}
        />
      )}
    </View>
  );
}

function MaskinDelRad({
  del,
  indeks,
  organizationId,
  projectId,
  kanSlett,
  onChange,
  onSlett,
}: {
  del: MaskinDel;
  indeks: number;
  organizationId: string;
  projectId: string;
  kanSlett: boolean;
  onChange: (felt: Partial<MaskinDel>) => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  const [visEquipment, setVisEquipment] = useState(false);
  const [visEnhet, setVisEnhet] = useState(false);
  const [visEco, setVisEco] = useState(false);

  const equipment = useMemo(() => {
    if (!del.vehicleId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(equipmentLocal)
        .where(eq(equipmentLocal.id, del.vehicleId))
        .all()[0] ?? null
    );
  }, [del.vehicleId]);

  const eco = useMemo(() => {
    if (!del.externalCostObjectId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, del.externalCostObjectId))
        .all()[0] ?? null
    );
  }, [del.externalCostObjectId]);

  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <DelHeader indeks={indeks} kanSlett={kanSlett} onSlett={onSlett} />
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.utstyr")} *
        </Text>
        <VelgerFelt
          verdi={
            equipment
              ? `${equipment.merke ?? ""} ${equipment.modell ?? ""}`.trim() ||
                equipment.internNavn ||
                null
              : null
          }
          placeholder={t("timer.velgUtstyr")}
          onPress={() => setVisEquipment(true)}
          underTekst={
            equipment?.internNummer ? `#${equipment.internNummer}` : null
          }
        />
      </View>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.antallTimer")} *
        </Text>
        <TextInput
          value={del.timerTekst}
          onChangeText={(v) => onChange({ timerTekst: v })}
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
            value={del.mengdeTekst}
            onChangeText={(v) => onChange({ mengdeTekst: v })}
            placeholder="0,00"
            keyboardType="decimal-pad"
            inputAccessoryViewID={TASTATUR_FERDIG_ID}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
          />
          <VelgerFelt
            verdi={del.enhet || null}
            placeholder={t("timer.felt.enhet")}
            onPress={() => setVisEnhet(true)}
          />
        </View>
      </View>
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.underprosjekt")}
        </Text>
        <VelgerFelt
          verdi={eco ? `${eco.proAdmId} — ${eco.kortNavn}` : null}
          placeholder={t("timer.velgUnderprosjekt")}
          onPress={() => setVisEco(true)}
          onClear={() => onChange({ externalCostObjectId: null })}
        />
      </View>

      {visEquipment && (
        <EquipmentVelgerModal
          organizationId={organizationId}
          valgtId={del.vehicleId}
          onVelg={(id) => {
            onChange({ vehicleId: id });
            setVisEquipment(false);
          }}
          onLukk={() => setVisEquipment(false)}
        />
      )}
      {visEnhet && (
        <EnhetVelgerModal
          valgt={del.enhet ?? ""}
          onVelg={(v) => {
            onChange({ enhet: v || null });
            setVisEnhet(false);
          }}
          onLukk={() => setVisEnhet(false)}
        />
      )}
      {visEco && (
        <UnderprosjektVelgerModal
          projectId={projectId}
          valgtId={del.externalCostObjectId}
          onVelg={(id) => {
            onChange({ externalCostObjectId: id });
            setVisEco(false);
          }}
          onLukk={() => setVisEco(false)}
        />
      )}
    </View>
  );
}

function TilleggDelRad({
  del,
  indeks,
  kanSlett,
  onChange,
  onSlett,
}: {
  del: TilleggDel;
  indeks: number;
  kanSlett: boolean;
  onChange: (felt: Partial<TilleggDel>) => void;
  onSlett: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <DelHeader indeks={indeks} kanSlett={kanSlett} onSlett={onSlett} />
      <View>
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.antall")} *
        </Text>
        <TextInput
          value={del.antallTekst}
          onChangeText={(v) => onChange({ antallTekst: v })}
          placeholder="0,00"
          keyboardType="decimal-pad"
          inputAccessoryViewID={TASTATUR_FERDIG_ID}
          className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
        />
      </View>
    </View>
  );
}
