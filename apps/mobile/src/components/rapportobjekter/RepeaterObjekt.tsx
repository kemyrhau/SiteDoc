import { useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { leggTilVedleggIRad } from "@sitedoc/shared";
import type { RapportObjektProps, RapportObjekt, OppgavePosisjon } from "./typer";
import type { FeltVerdi } from "../../hooks/useSjekklisteSkjema";
import { RapportObjektRenderer, DISPLAY_TYPER, tilbehorVisning } from "./RapportObjektRenderer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

/**
 * Repeater-RAD (rad-id-vedtak 2026-08-22, variant OMSLUTTING): `{ _radId, felter }`. `_radId`
 * er en STABIL id (expo-crypto uuid) bevart gjennom redigering/sletting — fundamentet for
 * persistente rad-scopede oppgaver. Lokal type (mobil har egen radrenderer + SQLite-offline).
 */
interface Rad {
  _radId: string;
  felter: Record<string, FeltVerdi>;
}

/** Migrer-ved-lesing: gammel naken-Record-rad omsluttes og får ny stabil id. Kalleren
 *  memoiserer på `verdi` så id-en er stabil på tvers av rendringer + persisteres ved neste
 *  lagring (offline-rader lagret før endringen åpnes og redigeres som før — de får id ved lesing). */
function normaliserRad(raa: unknown): Rad {
  if (raa && typeof raa === "object" && "felter" in raa) return raa as Rad;
  return { _radId: randomUUID(), felter: (raa ?? {}) as Record<string, FeltVerdi> };
}

/** Radens forhåndsposisjon: `drawing_position`-barnefeltets verdi (stabil under `_radId`).
 *  Mobil `TegningPosisjonObjekt` er foreløpig en placeholder → i praksis null; kalleren faller
 *  da til dokumentets lokasjon. */
function posisjonFraRad(rad: Rad, barn: RapportObjekt[]): OppgavePosisjon | null {
  const posBarn = barn.find((b) => b.type === "drawing_position");
  const pos = posBarn ? (rad.felter[posBarn.id]?.verdi as
    | { drawingId?: string; positionX?: number; positionY?: number }
    | null
    | undefined) : null;
  if (!pos || !pos.drawingId) return null;
  return { drawingId: pos.drawingId, positionX: pos.positionX ?? null, positionY: pos.positionY ?? null };
}

export function RepeaterObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  barneObjekter,
  sjekklisteId,
  oppgaveIdForKo,
  radOppgaver,
  tillatteFaggruppeIder,
}: RapportObjektProps) {
  const { t } = useTranslation();
  // Rad-id (2026-08-22): normaliser gammel/ny radform ved lesing → { _radId, felter }.
  // Memoisert på `verdi` så id-ene er STABILE på tvers av rendringer (ikke ny uuid per render).
  const rader = useMemo<Rad[]>(
    () => (Array.isArray(verdi) ? (verdi as unknown[]).map(normaliserRad) : []),
    [verdi],
  );
  const barn = barneObjekter ?? [];

  // Ref for å unngå stale closure i asynkrone callbacks (kamera)
  const raderRef = useRef(rader);
  raderRef.current = rader;

  const leggTilRad = useCallback(() => {
    const felter: Record<string, FeltVerdi> = {};
    for (const b of barn) {
      felter[b.id] = { ...TOM_FELTVERDI };
    }
    onEndreVerdi([...raderRef.current, { _radId: randomUUID(), felter }]);
  }, [barn, onEndreVerdi]);

  const fjernRad = useCallback(
    (indeks: number) => {
      onEndreVerdi(raderRef.current.filter((_, i) => i !== indeks));
    },
    [onEndreVerdi],
  );

  const opprettRadOppgave = useCallback(
    (rad: Rad, radIndeks: number) => {
      // 🔴 LOAD-BEARING: persister rad-id-ene FØR opprettelse. En offline-rad lagret før rad-id-
      // endringen har gammel form (rå `felter`, ingen `_radId`); uten dette ville neste LESING delt
      // ut en NY uuid via `normaliserRad`, og oppgavens nøkkel (`objekt.id:<denne uuid-en>`) ble
      // foreldreløs etter reload/re-sync. Å skrive `{ _radId, felter }`-formen NÅ persisterer id-en.
      // Idempotent: rader som allerede HAR id skrives uendret. (Kenneth-vedtak 2026-08-22.)
      onEndreVerdi(raderRef.current);
      radOppgaver?.onOpprett(`${objekt.id}:${rad._radId}`, posisjonFraRad(rad, barn), radIndeks + 1);
    },
    [barn, objekt.id, radOppgaver, onEndreVerdi],
  );

  const oppdaterFeltVerdi = useCallback(
    (radIndeks: number, feltId: string, nyVerdi: unknown) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, felter: { ...rad.felter, [feltId]: { ...eksisterende, verdi: nyVerdi } } };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  const oppdaterKommentar = useCallback(
    (radIndeks: number, feltId: string, kommentar: string) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, felter: { ...rad.felter, [feltId]: { ...eksisterende, kommentar } } };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  const leggTilVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedlegg: FeltVerdi["vedlegg"][number]) => {
      // FUNKSJONELL append: transformér mot FORRIGE (nummererte) hook-state via en
      // updater, ikke mot raderRef-snapshotet. En batch fra galleriet legger inn N
      // bilder sekvensielt; med snapshot vant siste skriving (kun ett bilde overlevde),
      // med updater akkumulerer alle N uansett render-timing. `leggTilVedleggIRad` er
      // den delte, testede transformen (@sitedoc/shared). Faller tilbake til raderRef
      // om forrige ikke er en array (skal ikke skje for en repeater).
      onEndreVerdi((forrige: unknown) =>
        leggTilVedleggIRad(
          Array.isArray(forrige)
            ? (forrige as unknown[]).map(normaliserRad)
            : raderRef.current,
          radIndeks,
          feltId,
          vedlegg,
        ),
      );
    },
    [onEndreVerdi],
  );

  const fjernVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedleggId: string) => {
      const oppdatert = raderRef.current.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          felter: {
            ...rad.felter,
            [feltId]: {
              ...eksisterende,
              vedlegg: (eksisterende.vedlegg ?? []).filter((v) => v.id !== vedleggId),
            },
          },
        };
      });
      onEndreVerdi(oppdatert);
    },
    [onEndreVerdi],
  );

  if (barn.length === 0) {
    return (
      <View className="rounded-lg border border-dashed border-gray-300 px-4 py-6">
        <Text className="text-center text-sm text-gray-400">
          {t("felt.ingenFelter")}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-1.5">
      {rader.map((rad, radIndeks) => (
        <View
          key={rad._radId}
          className="rounded border border-gray-200 bg-gray-50 px-3 py-2"
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold text-gray-400">
              {radIndeks + 1} {objekt.label}
            </Text>
            <View className="flex-row items-center gap-2">
              {/* C: FLERE oppgaver per rad — én badge per oppgave + «+ Oppgave» blir stående ved
                  siden av (erstattes ikke). Whole-field-oppgave på repeater er avskrudd. */}
              {radOppgaver &&
                (() => {
                  const nokkel = `${objekt.id}:${rad._radId}`;
                  const opgListe = radOppgaver.finnForRad(nokkel);
                  return (
                    <>
                      {opgListe.map((opg) => (
                        <Pressable
                          key={opg.id}
                          onPress={() => radOppgaver.onNaviger(opg.id)}
                          className="rounded-full bg-blue-100 px-2.5 py-0.5"
                          hitSlop={6}
                        >
                          <Text className="text-[11px] font-medium text-blue-700">
                            {opg.nummer ?? t("felt.oppgave")}
                          </Text>
                        </Pressable>
                      ))}
                      {!leseModus && (
                        <Pressable
                          onPress={() => opprettRadOppgave(rad, radIndeks)}
                          className="flex-row items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5"
                          hitSlop={6}
                        >
                          <Plus size={11} color="#6b7280" />
                          <Text className="text-[11px] text-gray-500">
                            {t("felt.oppgave")}
                          </Text>
                        </Pressable>
                      )}
                    </>
                  );
                })()}
              {!leseModus && (
                <Pressable onPress={() => fjernRad(radIndeks)} hitSlop={8}>
                  <Trash2 size={12} color="#fca5a5" />
                </Pressable>
              )}
            </View>
          </View>

          <View className="gap-1">
            {barn.map((barnObjekt) => {
              const feltVerdi = rad.felter[barnObjekt.id] ?? TOM_FELTVERDI;
              const erDisplay = DISPLAY_TYPER.has(barnObjekt.type);

              if (erDisplay) {
                return (
                  <View key={barnObjekt.id}>
                    <RapportObjektRenderer
                      objekt={barnObjekt}
                      verdi={feltVerdi.verdi}
                      onEndreVerdi={(v) =>
                        oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                      }
                      leseModus={leseModus}
                    />
                  </View>
                );
              }

              // Arv-tegning fra forrige rad (Kenneth-vedtak 2026-09-02): kun for
              // drawing_position, kun rad ≥ 2. Forrige rads drawingId for SAMME barnefelt
              // → forhåndsvalg i TegningPosisjonObjekt når denne raden ikke har egen tegning.
              const arvetDrawingId =
                barnObjekt.type === "drawing_position" && radIndeks > 0
                  ? ((rader[radIndeks - 1]?.felter[barnObjekt.id]?.verdi as
                      | { drawingId?: string | null }
                      | null
                      | undefined)?.drawingId ?? null)
                  : null;

              return (
                <View key={barnObjekt.id}>
                  <RapportObjektRenderer
                    objekt={barnObjekt}
                    verdi={feltVerdi.verdi}
                    onEndreVerdi={(v) =>
                      oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                    }
                    leseModus={leseModus}
                    tillatteFaggruppeIder={tillatteFaggruppeIder}
                    arvetDrawingId={arvetDrawingId}
                  />
                  {(() => {
                    // Funn 6: deny-list per BARNEFELT-TYPE (text_field-barn beholder tilbehør).
                    const harData = !!feltVerdi.kommentar?.trim() || (feltVerdi.vedlegg?.length ?? 0) > 0;
                    const tv = tilbehorVisning(barnObjekt.type, !!leseModus, harData);
                    return tv.vis ? (
                      <FeltDokumentasjon
                        kommentar={feltVerdi.kommentar ?? ""}
                        vedlegg={feltVerdi.vedlegg ?? []}
                        onEndreKommentar={(k) =>
                          oppdaterKommentar(radIndeks, barnObjekt.id, k)
                        }
                        onLeggTilVedlegg={(v) =>
                          leggTilVedlegg(radIndeks, barnObjekt.id, v)
                        }
                        onFjernVedlegg={(vId) =>
                          fjernVedlegg(radIndeks, barnObjekt.id, vId)
                        }
                        leseModus={tv.leseModus}
                        sjekklisteId={sjekklisteId}
                        oppgaveIdForKo={oppgaveIdForKo}
                        objektId={barnObjekt.id}
                        skjulKommentar={barnObjekt.type === "text_field"}
                      />
                    ) : null;
                  })()}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {!leseModus && (
        <Pressable
          onPress={leggTilRad}
          className="flex-row items-center justify-center gap-1.5 rounded border border-dashed border-gray-300 py-2"
        >
          <Plus size={14} color="#6b7280" />
          <Text className="text-xs text-gray-500">{t("felt.leggTilRad")}</Text>
        </Pressable>
      )}
    </View>
  );
}
