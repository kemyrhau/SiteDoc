import type { RapportObjektProps } from "./typer";
import { normaliserOpsjon } from "./typer";

export function EnkeltvalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <div className="flex flex-col gap-2">
      {alternativer.map((alt, index) => {
        const erValgt = valgtVerdi === alt.value;
        return (
          <button
            key={`${alt.value}-${index}`}
            type="button"
            onClick={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : alt.value);
            }}
            disabled={leseModus}
            className="flex items-center gap-3 py-1 text-left disabled:cursor-not-allowed"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
              }`}
            >
              {erValgt && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span className="text-sm text-gray-900">{alt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
