"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RapportObjektProps, FeltVerdi } from "./typer";
import { TOM_FELTVERDI } from "./typer";
import { RapportObjektRenderer, DISPLAY_TYPER } from "./RapportObjektRenderer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

type RadData = Record<string, FeltVerdi>;
type RepeaterVerdi = RadData[];

export function RepeaterObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  prosjektId,
  barneObjekter,
}: RapportObjektProps) {
  const rader = Array.isArray(verdi) ? (verdi as RepeaterVerdi) : [];
  const barn = barneObjekter ?? [];

  const leggTilRad = useCallback(() => {
    const nyRad: RadData = {};
    for (const b of barn) {
      nyRad[b.id] = { ...TOM_FELTVERDI };
    }
    onEndreVerdi([...rader, nyRad]);
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
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, [feltId]: { ...eksisterende, verdi: nyVerdi } };
      });
      onEndreVerdi(oppdatert);
    },
    [rader, onEndreVerdi],
  );

  const oppdaterKommentar = useCallback(
    (radIndeks: number, feltId: string, kommentar: string) => {
      const oppdatert = rader.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return { ...rad, [feltId]: { ...eksisterende, kommentar } };
      });
      onEndreVerdi(oppdatert);
    },
    [rader, onEndreVerdi],
  );

  const leggTilVedlegg = useCallback(
    (radIndeks: number, feltId: string, vedlegg: FeltVerdi["vedlegg"][number]) => {
      const oppdatert = rader.map((rad, i) => {
        if (i !== radIndeks) return rad;
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          [feltId]: {
            ...eksisterende,
            vedlegg: [...(eksisterende.vedlegg ?? []), vedlegg],
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
        const eksisterende = rad[feltId] ?? { ...TOM_FELTVERDI };
        return {
          ...rad,
          [feltId]: {
            ...eksisterende,
            vedlegg: (eksisterende.vedlegg ?? []).filter((v) => v.id !== vedleggId),
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
          key={radIndeks}
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
              const feltVerdi = rad[barnObjekt.id] ?? TOM_FELTVERDI;
              const erDisplay = DISPLAY_TYPER.has(barnObjekt.type);

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
                  />
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
                    leseModus={leseModus}
                    skjulKommentar={barnObjekt.type === "text_field"}
                    prosjektId={prosjektId}
                  />
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
