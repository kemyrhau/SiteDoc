import { useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { HjelpIkon } from "../HjelpIkon";
import { TilleggRadModal } from "./TilleggSeksjon";
import { UtleggRadModal } from "./UtleggSeksjon";
import { finnTilleggLokalt, finnUtleggskategoriLokalt } from "../../services/timerKatalog";
import { slettLokaltBilde } from "../../services/lokalBilde";
import type { LonnUtlegg } from "../../utils/dagsforslagAnvend";
import type { BeskrivelseKort } from "../../utils/beskrivelseKort";
import { kortForLinje } from "../../utils/lonnUtleggKort";

/**
 * ORDRE Tillegg/Utlegg i Bekreft dag: lønnstillegg og utlegg føres her og holdes
 * i minnet (`verdi`) til [Bekreft og lagre] — da skrives de på første åpne dato
 * sin sedel. Linjene er knyttet til sedel + prosjekt, ikke til en arbeidsrad.
 * Modalene er de samme som i prosjektkortet; tillegg-vedlegg legges til
 * etterpå i prosjektkortet (B1).
 *
 * T12 (spec tillegg-utlegg-prosjektkort § 5, B6): hver linje hører til ett
 * kort (prosjekt + byggeplass). Ny linje får prosjektets kort med flest timer
 * (`standardKortFor`). Med flere kort vises kortvalg pr. linje.
 */
export function BekreftDagLonnUtlegg({
  verdi,
  onEndre,
  organizationId,
  defaultProjectId,
  prosjektValg,
  kort,
  standardKortFor,
  kortEtikett,
  onFjernKvittering,
}: {
  verdi: LonnUtlegg;
  onEndre: (neste: (forrige: LonnUtlegg) => LonnUtlegg) => void;
  organizationId: string;
  /** Prosjektet med flest arbeidstimer i forslaget. */
  defaultProjectId: string;
  prosjektValg: { id: string; navn: string }[];
  /** Kortene med arbeid i forslaget (`kortMedArbeid`). */
  kort: BeskrivelseKort[];
  /** Prosjektets kort med flest timer — ny linjes kort. */
  standardKortFor: (projectId: string) => BeskrivelseKort | null;
  kortEtikett: (k: BeskrivelseKort) => string;
  /**
   * RETUR avvik 10: med utkast eier skjermen sletting av kvitteringsfila (den
   * slettes først når en utkastversjon uten utlegget er skrevet). Uten callback
   * slettes fila straks, som før.
   */
  onFjernKvittering?: (lokalSti: string) => void;
}) {
  const { t } = useTranslation();
  const [visTillegg, setVisTillegg] = useState(false);
  const [visUtlegg, setVisUtlegg] = useState(false);
  const prosjektNavn = (id: string) => prosjektValg.find((p) => p.id === id)?.navn ?? "";
  const visKortValg = kort.length > 1;
  const flereProsjekter = !visKortValg && prosjektValg.length > 1;
  const nyttKort = (projectId: string) => ({ projectId, byggeplassId: standardKortFor(projectId)?.byggeplassId ?? null });
  const kortVelger = (
    linje: { projectId: string; byggeplassId?: string | null },
    velg: (k: BeskrivelseKort) => void,
  ) => {
    if (!visKortValg) return null;
    const valgt = kortForLinje(linje, kort);
    return (
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-gray-500">{t("timer.bekreftDag.lonnUtlegg.kortValg")}</Text>
        {kort.map((k) => {
          const aktiv = valgt?.nokkel === k.nokkel;
          return (
            <Pressable
              key={k.nokkel}
              onPress={() => velg(k)}
              accessibilityRole="button"
              accessibilityState={{ selected: aktiv }}
              className={`rounded-full border px-3 py-1 ${aktiv ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"}`}
            >
              <Text className={`text-sm ${aktiv ? "text-blue-700" : "text-gray-700"}`}>{kortEtikett(k)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View className="gap-3">
      <Overskrift
        tittel={t("timer.kol.tillegg")}
        hjelp={<HjelpIkon tittel={t("hjelp.tillegg.tittel")} tekst={t("hjelp.tillegg.tekst")} />}
        leggTilEtikett={t("timer.tilfoy.tillegg")}
        onLeggTil={() => setVisTillegg(true)}
      />
      {verdi.tillegg.map((l) => {
        const katalog = finnTilleggLokalt(l.tilleggId);
        const detalj = [
          katalog?.type === "antall" ? String(l.antall) : null,
          flereProsjekter ? prosjektNavn(l.projectId) : null,
          l.kommentar,
        ].filter(Boolean).join(" · ");
        return (
          <Linje
            key={l.lokalId}
            tekst={katalog?.navn ?? l.tilleggId}
            detalj={detalj}
            onFjern={() => onEndre((f) => ({ ...f, tillegg: f.tillegg.filter((x) => x.lokalId !== l.lokalId) }))}
          >
            {kortVelger(l, (k) =>
              onEndre((f) => ({
                ...f,
                tillegg: f.tillegg.map((x) =>
                  x.lokalId === l.lokalId ? { ...x, projectId: k.projectId, byggeplassId: k.byggeplassId } : x,
                ),
              })),
            )}
          </Linje>
        );
      })}

      <Overskrift
        tittel={t("timer.kol.utlegg")}
        hjelp={<HjelpIkon tittel={t("hjelp.utlegg.tittel")} tekst={t("hjelp.utlegg.tekst")} />}
        leggTilEtikett={t("timer.tilfoy.utlegg")}
        onLeggTil={() => setVisUtlegg(true)}
      />
      {verdi.utlegg.map((u) => {
        const kategori = finnUtleggskategoriLokalt(u.expenseCategoryId);
        const detalj = [
          u.belop != null ? u.belop.toFixed(2) : null,
          flereProsjekter ? prosjektNavn(u.projectId) : null,
          u.kvittering ? t("timer.kvittering") : null,
          u.kommentar,
        ].filter(Boolean).join(" · ");
        return (
          <Linje
            key={u.id}
            tekst={kategori?.navn ?? u.expenseCategoryId}
            detalj={detalj}
            onFjern={() => {
              // Kvitteringen er ikke registrert ennå — fila ryddes med linja.
              const sti = u.kvittering?.lokalSti;
              if (sti) {
                if (onFjernKvittering) onFjernKvittering(sti);
                else void slettLokaltBilde(sti);
              }
              onEndre((f) => ({ ...f, utlegg: f.utlegg.filter((x) => x.id !== u.id) }));
            }}
          >
            {kortVelger(u, (k) =>
              onEndre((f) => ({
                ...f,
                utlegg: f.utlegg.map((x) =>
                  x.id === u.id ? { ...x, projectId: k.projectId, byggeplassId: k.byggeplassId } : x,
                ),
              })),
            )}
          </Linje>
        );
      })}

      {visTillegg && (
        <TilleggRadModal
          eksisterendeRad={null}
          organizationId={organizationId}
          defaultProjectId={defaultProjectId}
          onLagre={(projectId, tilleggId, antall, kommentar) => {
            onEndre((f) => ({
              ...f,
              tillegg: [...f.tillegg, { lokalId: randomUUID(), ...nyttKort(projectId), tilleggId, antall, kommentar }],
            }));
            setVisTillegg(false);
          }}
          onLukk={() => setVisTillegg(false)}
        />
      )}
      {visUtlegg && (
        <UtleggRadModal
          eksisterendeRad={null}
          organizationId={organizationId}
          projectId={defaultProjectId}
          prosjektValg={prosjektValg}
          sheetId=""
          onLagreEndring={() => setVisUtlegg(false)}
          onOpprettet={() => setVisUtlegg(false)}
          onOpprett={(u) => {
            onEndre((f) => ({ ...f, utlegg: [...f.utlegg, { ...u, ...nyttKort(u.projectId) }] }));
            setVisUtlegg(false);
          }}
          onLukk={() => setVisUtlegg(false)}
        />
      )}
    </View>
  );
}

function Overskrift({
  tittel,
  hjelp,
  leggTilEtikett,
  onLeggTil,
}: {
  tittel: string;
  hjelp: ReactNode;
  leggTilEtikett: string;
  onLeggTil: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">{tittel}</Text>
        {hjelp}
      </View>
      <Pressable
        onPress={onLeggTil}
        accessibilityRole="button"
        accessibilityLabel={leggTilEtikett}
        hitSlop={12}
        className="rounded-full bg-blue-600 p-1.5"
      >
        <Plus size={14} color="#ffffff" />
      </Pressable>
    </View>
  );
}

function Linje({
  tekst,
  detalj,
  onFjern,
  children,
}: {
  tekst: string;
  detalj: string;
  onFjern: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <View className="flex-1">
        <Text className="text-base text-gray-900">{tekst}</Text>
        {detalj ? <Text className="text-sm text-gray-500">{detalj}</Text> : null}
        {children}
      </View>
      <Pressable
        onPress={onFjern}
        accessibilityRole="button"
        accessibilityLabel={t("handling.fjern")}
        hitSlop={12}
        className="p-1"
      >
        <Trash2 size={18} color="#6b7280" />
      </Pressable>
    </View>
  );
}
