import type { RapportObjektProps } from "./typer";
import { normaliserOpsjon } from "./typer";

export function FlervalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgteVerdier = Array.isArray(verdi) ? (verdi as string[]) : [];

  const veksle = (alternativVerdi: string) => {
    if (leseModus) return;
    if (valgteVerdier.includes(alternativVerdi)) {
      onEndreVerdi(valgteVerdier.filter((v) => v !== alternativVerdi));
    } else {
      onEndreVerdi([...valgteVerdier, alternativVerdi]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {alternativer.map((alt, index) => {
        const erValgt = valgteVerdier.includes(alt.value);
        return (
          <button
            key={`${alt.value}-${index}`}
            type="button"
            onClick={() => veksle(alt.value)}
            disabled={leseModus}
            className="flex items-center gap-3 py-1 text-left disabled:cursor-not-allowed"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
              }`}
            >
              {erValgt && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-sm text-gray-900">{alt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
