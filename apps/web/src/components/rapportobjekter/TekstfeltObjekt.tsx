import type { RapportObjektProps } from "./typer";

export function TekstfeltObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const tekstVerdi = typeof verdi === "string" ? verdi : "";
  const erFlerlinjet = !!objekt.config.multiline;

  if (erFlerlinjet) {
    return (
      <textarea
        value={tekstVerdi}
        onChange={(e) => onEndreVerdi(e.target.value || null)}
        placeholder={typeof objekt.config.placeholder === "string" ? objekt.config.placeholder : "Skriv her..."}
        disabled={leseModus}
        rows={4}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
        }`}
      />
    );
  }

  return (
    <input
      type="text"
      value={tekstVerdi}
      onChange={(e) => onEndreVerdi(e.target.value || null)}
      placeholder={typeof objekt.config.placeholder === "string" ? objekt.config.placeholder : "Skriv her..."}
      disabled={leseModus}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
      }`}
    />
  );
}
