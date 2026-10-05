import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { WifiOff, Clock, Check, AlertTriangle, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type {
  Sammenligning,
  Side,
  TimerRad,
} from "../../lib/dagskortSammenligning";

/**
 * U-BEKREFT steg 1 — VISNINGEN (ingen skrivevei).
 *
 * Viser begge dagskort pr. tidsrom når en sedel er i `conflict`: appens utregning mot
 * web-dagskortet, så arbeideren ser hva som skiller og hvilken som er maskinens.
 *
 * 🔴 Dette steget SKRIVER IKKE. Radvalget registreres i skjerm-state (modus B), men
 * ingenting anvendes — derfor er det INGEN «bekreft»-knapp, og en tydelig notis sier at
 * valget ikke er lagret ennå. Et valg som ser lagret ut men ikke er det, er verre enn
 * ingen visning. Modus C (låst sedel) er ren lesevisning uten valg-affordance.
 *
 * 🔴 Offline er en ekte grense: server-radenes innhold finnes ikke lokalt under conflict,
 * så uten nett har vi bare den ene siden. Da sier skjermen «får ikke kontakt» — aldri et
 * tomt web-panel som får brukeren til å tro at web-kortet er tomt. Beslutningen bor i den
 * rene `dagskortSammenligning`; her rendres den.
 */

function Panel({
  ikon,
  tittel,
  tekst,
}: {
  ikon: React.ReactNode;
  tittel: string;
  tekst: string;
}) {
  return (
    <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <View className="flex-row items-center gap-2">
        {ikon}
        <Text className="text-sm font-semibold text-gray-900">{tittel}</Text>
      </View>
      <Text className="mt-1 text-sm text-gray-700">{tekst}</Text>
    </View>
  );
}

/** Én side av en tidsrom-linje (appen eller web). `null` → «ingen registrering». */
function RadSide({
  etikett,
  rad,
  valgt,
  valgbar,
  onVelg,
}: {
  etikett: string;
  rad: TimerRad | null;
  valgt: boolean;
  valgbar: boolean;
  onVelg?: () => void;
}) {
  const { t } = useTranslation();
  const innhold = (
    <View className="flex-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium text-gray-500">{etikett}</Text>
        {valgbar && valgt && <Check size={16} color="#1e40af" />}
      </View>
      {rad ? (
        <>
          <Text className="text-sm font-semibold text-gray-900">
            {t("timer.sammenlign.timer", { timer: rad.timer })}
          </Text>
          {rad.beskrivelse ? (
            <Text className="text-xs text-gray-600" numberOfLines={2}>
              {rad.beskrivelse}
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="text-sm italic text-gray-400">
          {t("timer.sammenlign.ingenRegistrering")}
        </Text>
      )}
    </View>
  );

  // Kun valgbare, eksisterende rader er trykkbare. Modus C (ikke valgbar) og tomme
  // sider gir ingen trykkflate — ingen skrivevei, ingen illusjon av valg.
  const kanTrykke = valgbar && !!rad && !!onVelg;
  const ramme = valgt && valgbar ? "border-sitedoc-blue bg-blue-50" : "border-gray-200 bg-white";
  return kanTrykke ? (
    <Pressable
      onPress={onVelg}
      className={`flex-1 rounded-lg border p-2.5 ${ramme}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: valgt }}
    >
      {innhold}
    </Pressable>
  ) : (
    <View className={`flex-1 rounded-lg border p-2.5 ${ramme}`}>{innhold}</View>
  );
}

export function DagskortSammenligning({
  resultat,
  valg,
  onVelg,
  onVelgAlle,
  onBekreft,
  bekrefter = false,
}: {
  resultat: Sammenligning;
  /** Effektivt valg pr. slot-nøkkel (modus B). Ignorert i modus C. */
  valg: Record<string, Side>;
  /** Registrer valg for én slot i skjerm-state (modus B). Nøkkel = rad.nokkel ?? tidsrom. */
  onVelg: (nokkel: string, side: Side) => void;
  /**
   * V19-B (B-3): «hele dagen»-snarvei — sett samme side for ALLE valgbare slots.
   * Utelatt → ingen hele-dagen-knapper (eksisterende U-BEKREFT-modus).
   */
  onVelgAlle?: (side: Side) => void;
  /** Steg 2: anvend valgene → ett dagskort. Utelatt = kun visning (modus C/C-lesevisning). */
  onBekreft?: () => void;
  /** Mutasjonen pågår — deaktiver knappen. */
  bekrefter?: boolean;
}) {
  const { t } = useTranslation();

  if (resultat.slag === "offline") {
    return (
      <Panel
        ikon={<WifiOff size={16} color="#6b7280" />}
        tittel={t("timer.sammenlign.offlineTittel")}
        tekst={t("timer.sammenlign.offline")}
      />
    );
  }
  if (resultat.slag === "laster") {
    return (
      <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <ActivityIndicator size="small" color="#6b7280" />
        <Text className="text-sm text-gray-700">{t("timer.sammenlign.laster")}</Text>
      </View>
    );
  }
  if (resultat.slag === "utilgjengelig") {
    return (
      <Panel
        ikon={<AlertTriangle size={16} color="#b45309" />}
        tittel={t("timer.sammenlign.utilgjengeligTittel")}
        tekst={t("timer.sammenlign.utilgjengelig")}
      />
    );
  }

  const laast = resultat.slag === "modusC";

  return (
    <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <AlertTriangle size={16} color="#b91c1c" />
        <Text className="text-sm font-semibold text-red-900">
          {t("timer.sammenlign.tittel")}
        </Text>
      </View>

      {laast ? (
        <View className="mt-1 flex-row items-start gap-2">
          <Lock size={14} color="#b91c1c" style={{ marginTop: 2 }} />
          {/* Modus C: serverens egen formulering (timer.sync.konfliktBeskrivelse),
              ikke en ny melding. Ingen skrivevei herfra — retur går via lederen. */}
          <Text className="flex-1 text-sm text-red-800">
            {t("timer.sync.konfliktBeskrivelse")}
          </Text>
        </View>
      ) : (
        <Text className="mt-1 text-sm text-gray-700">
          {t("timer.sammenlign.innledning")}
        </Text>
      )}

      {resultat.rader.length === 0 ? (
        <Text className="mt-3 text-sm italic text-gray-400">
          {t("timer.sammenlign.ingenRader")}
        </Text>
      ) : (
        resultat.rader.map((rad) => {
          // Stabil, unik nøkkel: V19-overlapp setter `nokkel`; U-BEKREFT faller til
          // `tidsrom`. En ensidig slot er ikke valgbar (Q3(b): rad.valgbar === false).
          const key = rad.nokkel ?? rad.tidsrom;
          const radValgbar = !laast && rad.valgbar !== false;
          return (
            <View key={key} className="mt-3 border-t border-gray-100 pt-3">
              <View className="mb-1.5 flex-row items-center gap-1.5">
                <Clock size={13} color="#6b7280" />
                <Text className="text-xs font-semibold text-gray-700">{rad.tidsrom}</Text>
              </View>
              <View className="flex-row gap-2">
                <RadSide
                  etikett={t("timer.sammenlign.appen")}
                  rad={rad.lokal}
                  valgt={valg[key] === "lokal"}
                  valgbar={radValgbar}
                  onVelg={() => onVelg(key, "lokal")}
                />
                <RadSide
                  etikett={t("timer.sammenlign.web")}
                  rad={rad.server}
                  valgt={valg[key] === "server"}
                  valgbar={radValgbar}
                  onVelg={() => onVelg(key, "server")}
                />
              </View>
            </View>
          );
        })
      )}

      {/* V19-B (B-3): «hele dagen»-snarvei — to knapper som setter alle valgbare
          slots til samme side. Kun modus B med en skrivevei og minst én rad. */}
      {!laast && onVelgAlle && onBekreft && resultat.rader.length > 0 && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => onVelgAlle("lokal")}
            disabled={bekrefter}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-center text-sm font-medium text-gray-800">
              {t("timer.sammenlign.velgAlleAppen")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onVelgAlle("server")}
            disabled={bekrefter}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-center text-sm font-medium text-gray-800">
              {t("timer.sammenlign.velgAllePc")}
            </Text>
          </Pressable>
        </View>
      )}

      {!laast && onBekreft && resultat.rader.length > 0 && (
        <>
          <View className="mt-3 flex-row items-start gap-2 rounded-lg bg-amber-50 p-2.5">
            <AlertTriangle size={13} color="#b45309" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs text-amber-800">
              {t("timer.sammenlign.bekreftHjelp")}
            </Text>
          </View>
          <Pressable
            onPress={onBekreft}
            disabled={bekrefter}
            className={`mt-3 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
              bekrefter ? "bg-gray-300" : "bg-sitedoc-blue"
            }`}
            accessibilityRole="button"
          >
            {bekrefter ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Check size={18} color="#ffffff" />
            )}
            <Text className="text-sm font-semibold text-white">
              {t("timer.sammenlign.bekreft")}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
