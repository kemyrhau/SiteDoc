"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RapportObjektProps, FeltVerdi, Rad } from "./typer";
import { TOM_FELTVERDI, normaliserRad, nyRadId } from "./typer";
import { RapportObjektRenderer, DISPLAY_TYPER, tilbehorVisning } from "./RapportObjektRenderer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

export function RepeaterObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  prosjektId,
  barneObjekter,
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
