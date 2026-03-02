import type { RapportObjektProps } from "./typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
}

export function VaerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const vaerVerdi = (verdi as VaerVerdi) ?? {};

  const oppdater = (felt: keyof VaerVerdi, nyVerdi: string) => {
    onEndreVerdi({ ...vaerVerdi, [felt]: nyVerdi || undefined });
  };

  const inputKlasse = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
  }`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Temperatur</label>
        <input
          type="text"
          value={vaerVerdi.temp ?? ""}
          onChange={(e) => oppdater("temp", e.target.value)}
          placeholder="f.eks. 15°C"
          disabled={leseModus}
          className={inputKlasse}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Forhold</label>
        <input
          type="text"
          value={vaerVerdi.conditions ?? ""}
          onChange={(e) => oppdater("conditions", e.target.value)}
          placeholder="f.eks. Overskyet"
          disabled={leseModus}
          className={inputKlasse}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Vind</label>
        <input
          type="text"
          value={vaerVerdi.wind ?? ""}
          onChange={(e) => oppdater("wind", e.target.value)}
          placeholder="f.eks. 5 m/s NV"
          disabled={leseModus}
          className={inputKlasse}
        />
      </div>
    </div>
  );
}
