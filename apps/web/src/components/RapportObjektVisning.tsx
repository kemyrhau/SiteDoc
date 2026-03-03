"use client";

import { normaliserOpsjon } from "./rapportobjekter/typer";
import type { RapportObjekt } from "./rapportobjekter/typer";

// Trafikklys-farge → label + CSS-klasse
const TRAFIKKLYS: Record<string, { label: string; klasse: string }> = {
  green: { label: "Godkjent", klasse: "bg-green-500" },
  yellow: { label: "Anmerkning", klasse: "bg-yellow-400" },
  red: { label: "Avvik", klasse: "bg-red-500" },
  gray: { label: "Ikke relevant", klasse: "bg-gray-400" },
};

interface TreObjekt extends RapportObjekt {
  children: TreObjekt[];
}

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  kilde?: "manuell" | "automatisk";
}

interface TegningPosisjonVerdi {
  drawingId?: string;
  positionX?: number;
  positionY?: number;
  drawingName?: string;
}

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                   */
/* ------------------------------------------------------------------ */

function formaterDato(verdi: unknown): string {
  if (typeof verdi !== "string") return "";
  try {
    return new Date(verdi).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(verdi);
  }
}

function formaterDatoTid(verdi: unknown): string {
  if (typeof verdi !== "string") return "";
  try {
    return new Date(verdi).toLocaleString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(verdi);
  }
}

/* ------------------------------------------------------------------ */
/*  Felt-label + verdi-wrapper                                         */
/* ------------------------------------------------------------------ */

function FeltRad({
  label,
  children,
  tom,
}: {
  label: string;
  children: React.ReactNode;
  tom?: boolean;
}) {
  return (
    <div className="print-no-break py-2">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {tom ? (
        <p className="mt-0.5 text-sm italic text-gray-300">Ikke utfylt</p>
      ) : (
        <div className="mt-0.5">{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                     */
/* ------------------------------------------------------------------ */

export function RapportObjektVisning({
  objekt,
  verdi,
  nestingNivå = 0,
}: {
  objekt: TreObjekt;
  verdi: unknown;
  nestingNivå?: number;
}) {
  const marginKlasse =
    nestingNivå === 1
      ? "ml-4"
      : nestingNivå === 2
        ? "ml-8"
        : nestingNivå >= 3
          ? "ml-12"
          : "";
  const rammeKlasse =
    nestingNivå > 0 ? "border-l-2 border-l-blue-300 pl-4" : "";

  return (
    <div className={`${marginKlasse} ${rammeKlasse}`}>
      <ObjektInnhold objekt={objekt} verdi={verdi} />
      {objekt.children.length > 0 && (
        <div className="mt-1">
          {objekt.children.map((barn) => (
            <RapportObjektVisning
              key={barn.id}
              objekt={barn}
              verdi={null}
              nestingNivå={nestingNivå + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Type-spesifikk rendering                                           */
/* ------------------------------------------------------------------ */

function ObjektInnhold({
  objekt,
  verdi,
}: {
  objekt: TreObjekt;
  verdi: unknown;
}) {
  const { type, label } = objekt;

  switch (type) {
    case "heading":
      return (
        <h3 className="mt-4 border-b border-gray-200 pb-1 text-base font-semibold text-gray-900">
          {label}
        </h3>
      );

    case "subtitle":
      return (
        <h4 className="mt-2 text-sm font-medium text-gray-700">{label}</h4>
      );

    case "text_field": {
      const tekst = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "list_single": {
      const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
      const alternativer = råOpsjoner.map(normaliserOpsjon);
      const valgt =
        typeof verdi === "string"
          ? alternativer.find((a) => a.value === verdi)?.label ?? verdi
          : null;
      return (
        <FeltRad label={label} tom={!valgt}>
          <p className="text-sm text-gray-900">{valgt}</p>
        </FeltRad>
      );
    }

    case "list_multi": {
      const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
      const alternativer = råOpsjoner.map(normaliserOpsjon);
      const valgte = Array.isArray(verdi)
        ? (verdi as string[])
            .map((v) => alternativer.find((a) => a.value === v)?.label ?? v)
            .join(", ")
        : null;
      return (
        <FeltRad label={label} tom={!valgte}>
          <p className="text-sm text-gray-900">{valgte}</p>
        </FeltRad>
      );
    }

    case "traffic_light": {
      const farge = typeof verdi === "string" ? verdi : null;
      const tl = farge ? TRAFIKKLYS[farge] : null;
      return (
        <FeltRad label={label} tom={!tl}>
          {tl && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full ${tl.klasse}`}
              />
              <span className="text-sm text-gray-900">{tl.label}</span>
            </div>
          )}
        </FeltRad>
      );
    }

    case "integer":
    case "decimal": {
      const tall = verdi != null ? String(verdi) : "";
      const enhet = (objekt.config.unit as string) ?? "";
      return (
        <FeltRad label={label} tom={!tall}>
          <p className="text-sm text-gray-900">
            {tall}
            {enhet ? ` ${enhet}` : ""}
          </p>
        </FeltRad>
      );
    }

    case "calculation": {
      const resultat = verdi != null ? String(verdi) : "";
      const enhet = (objekt.config.unit as string) ?? "";
      return (
        <FeltRad label={label} tom={!resultat}>
          <p className="text-sm text-gray-900">
            {resultat}
            {enhet ? ` ${enhet}` : ""}
          </p>
        </FeltRad>
      );
    }

    case "date": {
      return (
        <FeltRad label={label} tom={!verdi}>
          <p className="text-sm text-gray-900">{formaterDato(verdi)}</p>
        </FeltRad>
      );
    }

    case "date_time": {
      return (
        <FeltRad label={label} tom={!verdi}>
          <p className="text-sm text-gray-900">{formaterDatoTid(verdi)}</p>
        </FeltRad>
      );
    }

    case "person": {
      const navn = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!navn}>
          <p className="text-sm text-gray-900">{navn}</p>
        </FeltRad>
      );
    }

    case "persons": {
      const personer = Array.isArray(verdi) ? (verdi as string[]).join(", ") : "";
      return (
        <FeltRad label={label} tom={!personer}>
          <p className="text-sm text-gray-900">{personer}</p>
        </FeltRad>
      );
    }

    case "company": {
      const firma = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!firma}>
          <p className="text-sm text-gray-900">{firma}</p>
        </FeltRad>
      );
    }

    case "attachments": {
      const vedlegg = Array.isArray(verdi) ? (verdi as Array<{ id?: string; url?: string; filnavn?: string; type?: string }>) : [];
      const bilder = vedlegg.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn ?? ""));
      const filer = vedlegg.filter((v) => !bilder.includes(v));
      return (
        <FeltRad label={label} tom={vedlegg.length === 0}>
          <div>
            {bilder.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {bilder.map((bilde, idx) => {
                  const url = bilde.url ?? "";
                  const src = url.startsWith("/uploads/") ? `/api/uploads${url.replace("/uploads", "")}` : url;
                  return (
                    <img
                      key={bilde.id ?? idx}
                      src={src}
                      alt={bilde.filnavn ?? "Vedlegg"}
                      className="w-full rounded border border-gray-200 object-cover"
                      style={{ aspectRatio: "5/4" }}
                    />
                  );
                })}
              </div>
            )}
            {filer.length > 0 && (
              <p className="mt-1 text-sm text-gray-600">
                {filer.map((f) => f.filnavn).join(", ")}
              </p>
            )}
          </div>
        </FeltRad>
      );
    }

    case "weather": {
      const v = (verdi as VaerVerdi) ?? {};
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      const tekst = deler.join(", ");
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "signature": {
      const harSignatur = typeof verdi === "string" && verdi.length > 0;
      return (
        <FeltRad label={label} tom={!harSignatur}>
          {harSignatur ? (
            <img
              src={verdi as string}
              alt="Signatur"
              className="max-h-[80px]"
            />
          ) : null}
        </FeltRad>
      );
    }

    case "location": {
      const tekst = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "drawing_position": {
      const pos = verdi as TegningPosisjonVerdi | null;
      const tekst = pos?.drawingName
        ? `${pos.drawingName} (${pos.positionX?.toFixed(0)}%, ${pos.positionY?.toFixed(0)}%)`
        : "";
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "repeater": {
      return (
        <FeltRad label={label} tom>
          <p className="text-sm text-gray-400">Repeterende seksjon</p>
        </FeltRad>
      );
    }

    default: {
      const tekstVerdi = verdi != null ? String(verdi) : "";
      return (
        <FeltRad label={label} tom={!tekstVerdi}>
          <p className="text-sm text-gray-900">{tekstVerdi}</p>
        </FeltRad>
      );
    }
  }
}
