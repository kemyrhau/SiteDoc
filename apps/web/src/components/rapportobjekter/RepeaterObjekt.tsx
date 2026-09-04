"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RapportObjektProps, FeltVerdi, Rad, RapportObjekt, OppgavePosisjon } from "./typer";
import { TOM_FELTVERDI, normaliserRad, nyRadId } from "./typer";
import { RapportObjektRenderer, DISPLAY_TYPER, tilbehorVisning } from "./RapportObjektRenderer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

/**
 * Radens forhåndsposisjon: verdien til et `drawing_position`-barnefelt i raden (hvis malen har
 * ett og raden har fylt det). Lagres som vanlig barnefelt-verdi under `_radId` → stabil. Null →
 * kalleren faller til dokumentets lokasjon.
 */
function posisjonFraRad(rad: Rad, barn: RapportObjekt[]): OppgavePosisjon | null {
  const posBarn = barn.find((b) => b.type === "drawing_position");
  const pos = posBarn ? (rad.felter[posBarn.id]?.verdi as
    | { drawingId?: string; positionX?: number; positionY?: number }
    | null
    | undefined) : null;
  if (!pos || !pos.drawingId) return null;
  return { drawingId: pos.drawingId, positionX: pos.positionX ?? null, positionY: pos.positionY ?? null };
}

/**
 * L9 (2026-09-04): tegningen (uten pin) en rad allerede peker på — for å forhåndsvelge «sist brukte»
 * tegning i neste rads feltpin-velger. Kun tegning + navn; koordinater bæres aldri videre.
 */
function tegningFraRad(rad: Rad, barn: RapportObjekt[]): { drawingId: string; drawingName?: string | null } | null {
  const posBarn = barn.find((b) => b.type === "drawing_position");
  const pos = posBarn ? (rad.felter[posBarn.id]?.verdi as
    | { drawingId?: string; drawingName?: string | null }
    | null
    | undefined) : null;
  if (!pos || !pos.drawingId) return null;
  return { drawingId: pos.drawingId, drawingName: pos.drawingName ?? null };
}

export function RepeaterObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  prosjektId,
  barneObjekter,
  radOppgaver,
  tillatteFaggruppeIder,
  dokumentTegning,
}: RapportObjektProps) {
  // Rad-id (2026-08-22, variant omslutting): normaliser gammel/ny radform ved lesing →
  // { _radId, felter }. Memoisert på `verdi`-referansen så id-ene er STABILE på tvers av
  // rendringer (ikke ny uuid per render). Gamle rader (uten id) får uuid som persisteres ved
  // neste lagring; ingen bruker mister en rad fordi den er gammel.
  const rader = useMemo<Rad[]>(
    () => (Array.isArray(verdi) ? (verdi as unknown[]).map(normaliserRad) : []),
    [verdi],
  );
  const barn = barneObjekter ?? [];

  // L9 (2026-09-04): «sist brukte» tegning for rad `radIndeks` — kildeprioritet (dokument-avgrenset,
  // aldri sesjonstilstand): (1) siste FORrige rad med en tegning, (2) ellers dokumentets
  // dokumentlokasjon-tegning, (3) ellers ingen. Kun tegning, aldri pin. Bevarer atferden «rad 2
  // lander på rad 1s tegning», men kilden er nå forutsigbar og innenfor dette dokumentet.
  const stickyForRad = useCallback(
    (radIndeks: number): { drawingId: string; drawingName?: string | null } | null => {
      for (let i = radIndeks - 1; i >= 0; i--) {
        const t = tegningFraRad(rader[i]!, barn);
        if (t) return t;
      }
      return dokumentTegning ?? null;
    },
    [rader, barn, dokumentTegning],
  );

  const leggTilRad = useCallback(() => {
    const felter: Record<string, FeltVerdi> = {};
    for (const b of barn) {
      felter[b.id] = { ...TOM_FELTVERDI };
    }
    onEndreVerdi([...rader, { _radId: nyRadId(), felter }]);
  }, [barn, rader, onEndreVerdi]);

  const fjernRad = useCallback(
    (indeks: number) => {
      onEndreVerdi(rader.filter((_, i) => i !== indeks));
    },
    [rader, onEndreVerdi],
  );

  const opprettRadOppgave = useCallback(
    (rad: Rad, radIndeks: number) => {
      // 🔴 LOAD-BEARING: persister rad-id-ene FØR opprettelse. Et dokument som aldri er redigert
      // etter rad-id-deployen har fortsatt gammel lagret form (rå `felter`, ingen `_radId`); da
      // ville neste LESING delt ut en NY uuid via `normaliserRad`, og oppgavens nøkkel
      // (`objekt.id:<denne uuid-en>`) ble foreldreløs etter reload. Å skrive `{ _radId, felter }`-
      // formen NÅ persisterer den in-memory id-en → nøkkelen matcher raden også etter reload.
      // Idempotent: rader som allerede HAR lagret id skrives uendret (samme id). Kravet er
      // «ekte id ved OPPRETTELSE av oppgaven, ikke ved neste lagring» (Kenneth-vedtak 2026-08-22).
      onEndreVerdi(rader);
      radOppgaver?.onOpprett(`${objekt.id}:${rad._radId}`, posisjonFraRad(rad, barn), radIndeks + 1);
    },
    [rader, barn, objekt.id, radOppgaver, onEndreVerdi],
  );

  const oppdaterFeltVerdi = useCallback(
    (radIndeks: number, feltId: string, nyVerdi: unknown) => {
      const oppdatert = rader.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, felter: { ...rad.felter, [feltId]: { ...eksisterende, verdi: nyVerdi } } };
      });
      onEndreVerdi(oppdatert);
    },
    [rader, onEndreVerdi],
  );

  const oppdaterKommentar = useCallback(
    (radIndeks: number, feltId: string, kommentar: string) => {
      const oppdatert = rader.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, felter: { ...rad.felter, [feltId]: { ...eksisterende, kommentar } } };
      });
      onEndreVerdi(oppdatert);
    },
    [rader, onEndreVerdi],
  );

  const leggTilVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedlegg: FeltVerdi["vedlegg"][number]) => {
      const oppdatert = rader.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad.felter[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          felter: {
            ...rad.felter,
            [feltId]: {
              ...eksisterende,
              vedlegg: [...(eksisterende.vedlegg ?? []), vedlegg],
            },
          },
        };
      });
      onEndreVerdi(oppdatert);
    },
    [rader, onEndreVerdi],
  );

  const fjernVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedleggId: string) => {
      const oppdatert = rader.map((rad, i) => {
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
    [rader, onEndreVerdi],
  );

  if (barn.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
        Ingen felter definert i malen for denne repeateren.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rader.map((rad, radIndeks) => (
        <div
          key={rad._radId}
          className="rounded border border-gray-200 bg-gray-50/50 px-3 py-2"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400">
              {radIndeks + 1} {objekt.label}
            </span>
            <div className="flex items-center gap-1.5">
              {/* Rad-scopet oppgave (nøkkel objekt.id:_radId). Badge vises alltid; «+ Oppgave»
                  kun i redigering. Whole-field-oppgave på repeateren er avskrudd — per-rad er
                  den entydige veien. */}
              {/* C (2026-08-22): FLERE oppgaver per rad. Én badge per oppgave + «+ Oppgave» blir
                  stående ved siden av (erstattes ikke) så en rad kan utløse flere (f.eks. KS-avvik
                  + bestilling). */}
              {radOppgaver &&
                (() => {
                  const nokkel = `${objekt.id}:${rad._radId}`;
                  const opgListe = radOppgaver.finnForRad(nokkel);
                  return (
                    <>
                      {opgListe.map((opg) => (
                        <button
                          key={opg.id}
                          type="button"
                          onClick={() => radOppgaver.onNaviger(opg.id)}
                          className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-200 print-skjul"
                        >
                          {opg.nummer ?? "Oppgave"}
                        </button>
                      ))}
                      {!leseModus && (
                        <button
                          type="button"
                          onClick={() => opprettRadOppgave(rad, radIndeks)}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-200 print-skjul"
                        >
                          <Plus size={11} />
                          Oppgave
                        </button>
                      )}
                    </>
                  );
                })()}
              {!leseModus && (
                <button
                  type="button"
                  onClick={() => fjernRad(radIndeks)}
                  className="rounded p-0.5 text-red-300 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {barn.map((barnObjekt) => {
              const feltVerdi = rad.felter[barnObjekt.id] ?? TOM_FELTVERDI;
              const erDisplay = DISPLAY_TYPER.has(barnObjekt.type);

              // Rad-unik nøkkel: felt som overlever navigasjon (drawing_position)
              // må skilles per rad, ellers overskriver rad 2 rad 1s resultat.
              const feltNokkel = `${barnObjekt.id}:${radIndeks}`;

              if (erDisplay) {
                return (
                  <div key={barnObjekt.id}>
                    <RapportObjektRenderer
                      objekt={barnObjekt}
                      verdi={feltVerdi.verdi}
                      onEndreVerdi={(v) =>
                        oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                      }
                      leseModus={leseModus}
                      prosjektId={prosjektId}
                      feltNokkel={feltNokkel}
                    />
                  </div>
                );
              }

              return (
                <div key={barnObjekt.id}>
                  <RapportObjektRenderer
                    objekt={barnObjekt}
                    verdi={feltVerdi.verdi}
                    onEndreVerdi={(v) =>
                      oppdaterFeltVerdi(radIndeks, barnObjekt.id, v)
                    }
                    leseModus={leseModus}
                    prosjektId={prosjektId}
                    feltNokkel={feltNokkel}
                    tillatteFaggruppeIder={tillatteFaggruppeIder}
                    stickyTegning={
                      barnObjekt.type === "drawing_position" ? stickyForRad(radIndeks) : undefined
                    }
                  />
                  {(() => {
                    // Funn 6: deny-list per BARNEFELT-TYPE (text_field-barn beholder tilbehør).
                    const harData = !!feltVerdi.kommentar?.trim() || (feltVerdi.vedlegg?.length ?? 0) > 0;
                    const tv = tilbehorVisning(barnObjekt.type, !!leseModus, harData);
                    return tv.vis ? (
                      <FeltDokumentasjon
                        kommentar={feltVerdi.kommentar}
                        vedlegg={feltVerdi.vedlegg}
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
                        skjulKommentar={barnObjekt.type === "text_field"}
                        prosjektId={prosjektId}
                      />
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!leseModus && (
        <button
          type="button"
          onClick={leggTilRad}
          className="flex items-center justify-center gap-1.5 rounded border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-600"
        >
          <Plus size={14} />
          Legg til rad
        </button>
      )}
    </div>
  );
}
