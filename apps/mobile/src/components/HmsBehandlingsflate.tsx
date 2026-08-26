import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * HMS-behandler-flate for mobil (H1, 2026-08-24) — port av web-`HmsHandlingsflate`.
 * HMS er et selvstendig løp ved siden av dokumentflyten; denne erstatter den generelle
 * `DokumentHandlingslinje` for `domain === "hms"`-dokumenter når brukeren er BEHANDLER.
 *
 * Handlinger (speiler server-guarden verifiserHmsHandling + de tre endepunktene):
 *   Besvar   — HMS-admin, sent·received·responded, OBLIGATORISK begrunnelse (hmsBesvar)
 *   Lukk     — HMS-admin, received·responded,     valgfri kommentar (hmsLukk)
 *   Gjenåpne — HMS-admin, closed,                 valgfri kommentar (hmsGjenapne)
 *
 * «Returner» er UTELATT med vilje: web har knappen, men `sjekkliste.hmsReturner` finnes ikke på
 * serveren (paritetsdok H7) — en alltid-feilende knapp skal ikke replikeres. Melderens «Tilføy
 * informasjon»/«Send inn» bor i melder-banneret, ikke her (behandler eier handlingen).
 *
 * Klienten avgjør synlighet; serveren håndhever autorisasjonen på nytt. Tomt obligatorisk felt
 * blokkeres her (speiler min(1) på serveren) så brukeren slipper en unødvendig serverrunde.
 */
export type HmsHandlingType = "besvar" | "lukk" | "gjenapne";

interface HmsHandlingDef {
  type: HmsHandlingType;
  labelKey: string;
  placeholderKey: string;
  obligatorisk: boolean;
  primaer: boolean;
}

const HANDLINGER: Record<HmsHandlingType, HmsHandlingDef> = {
  besvar: {
    type: "besvar",
    labelKey: "hms.handling.besvar",
    placeholderKey: "hms.handling.begrunnelsePlaceholder",
    obligatorisk: true,
    primaer: true,
  },
  lukk: {
    type: "lukk",
    labelKey: "hms.handling.lukk",
    placeholderKey: "statushandling.valgfriKommentar",
    obligatorisk: false,
    primaer: true,
  },
  gjenapne: {
    type: "gjenapne",
    labelKey: "hms.handling.gjenapne",
    placeholderKey: "statushandling.valgfriKommentar",
    obligatorisk: false,
    primaer: false,
  },
};

/** Speiler web `tilgjengeligeHandlinger` (uten returner). åpen = sent·received·responded. */
function tilgjengeligeHandlinger(status: string, erHmsAdmin: boolean): HmsHandlingType[] {
  if (!erHmsAdmin) return [];
  const åpen = status === "sent" || status === "received" || status === "responded";
  const liste: HmsHandlingType[] = [];
  if (åpen) liste.push("besvar");
  if (status === "received" || status === "responded") liste.push("lukk");
  if (status === "closed") liste.push("gjenapne");
  return liste;
}

export function HmsBehandlingsflate({
  status,
  erHmsAdmin,
  erLaster,
  feilmelding,
  onUtfor,
}: {
  status: string;
  erHmsAdmin: boolean;
  erLaster: boolean;
  feilmelding?: string | null;
  onUtfor: (type: HmsHandlingType, tekst: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [aktiv, setAktiv] = useState<HmsHandlingType | null>(null);
  const [tekst, setTekst] = useState("");

  const handlinger = tilgjengeligeHandlinger(status, erHmsAdmin);

  const lukkPanel = () => {
    setAktiv(null);
    setTekst("");
  };
  const send = (def: HmsHandlingDef) => {
    const trimmet = tekst.trim();
    if (def.obligatorisk && !trimmet) return;
    onUtfor(def.type, trimmet || undefined);
    lukkPanel();
  };

  if (handlinger.length === 0) {
    // Utkast eier melder-banneret (håndteres av forelderen); ellers ren lesevisning.
    if (status === "draft") return null;
    return <Text className="text-xs italic text-gray-400">{t("bunnbar.lesevisning")}</Text>;
  }

  const aktivDef = aktiv ? HANDLINGER[aktiv] : null;

  return (
    <View className="gap-2">
      {feilmelding ? (
        <View className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <Text className="text-sm text-red-700">{feilmelding}</Text>
        </View>
      ) : null}

      {aktivDef ? (
        <View className="gap-2">
          <Text className="text-xs font-medium text-gray-500">{t(aktivDef.labelKey)}</Text>
          <TextInput
            value={tekst}
            onChangeText={setTekst}
            placeholder={t(aktivDef.placeholderKey)}
            multiline
            autoFocus
            className="min-h-[72px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => send(aktivDef)}
              disabled={erLaster || (aktivDef.obligatorisk && !tekst.trim())}
              className={`rounded-lg bg-sitedoc-primary px-4 py-2.5 ${erLaster || (aktivDef.obligatorisk && !tekst.trim()) ? "opacity-50" : ""}`}
            >
              <Text className="text-sm font-medium text-white">
                {erLaster ? t("statushandling.endrer") : t(aktivDef.labelKey)}
              </Text>
            </Pressable>
            <Pressable
              onPress={lukkPanel}
              disabled={erLaster}
              className="rounded-lg border border-gray-300 px-4 py-2.5"
            >
              <Text className="text-sm text-gray-600">{t("handling.avbryt")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row flex-wrap items-center gap-2">
          {handlinger.map((type) => {
            const def = HANDLINGER[type];
            return (
              <Pressable
                key={type}
                onPress={() => {
                  setTekst("");
                  setAktiv(type);
                }}
                disabled={erLaster}
                className={
                  def.primaer
                    ? "rounded-lg bg-sitedoc-primary px-4 py-2.5"
                    : "rounded-lg border border-gray-300 px-4 py-2.5"
                }
              >
                <Text className={`text-sm font-medium ${def.primaer ? "text-white" : "text-gray-700"}`}>
                  {t(def.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
