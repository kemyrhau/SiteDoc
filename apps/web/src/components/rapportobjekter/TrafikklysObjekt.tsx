import type { RapportObjektProps } from "./typer";

const FARGER: { farge: string; aktiv: string; inaktiv: string; label: string }[] = [
  { farge: "green", aktiv: "bg-green-500", inaktiv: "bg-green-200", label: "Godkjent" },
  { farge: "yellow", aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200", label: "Anmerkning" },
  { farge: "red", aktiv: "bg-red-500", inaktiv: "bg-red-200", label: "Avvik" },
  { farge: "gray", aktiv: "bg-gray-400", inaktiv: "bg-gray-200", label: "Ikke relevant" },
];

export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <div className="flex items-center gap-2">
      {FARGER.map(({ farge, aktiv, inaktiv, label }) => {
        const erValgt = valgtVerdi === farge;
        const fargeKlasse = erValgt ? aktiv : inaktiv;
        return (
          <button
            key={farge}
            type="button"
            onClick={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : farge);
            }}
            disabled={leseModus}
            title={label}
            className={`h-7 w-7 rounded-full ${fargeKlasse} transition-all disabled:cursor-not-allowed ${
              erValgt ? "ring-2 ring-gray-800 ring-offset-1" : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
            }`}
          />
        );
      })}
    </div>
  );
}
