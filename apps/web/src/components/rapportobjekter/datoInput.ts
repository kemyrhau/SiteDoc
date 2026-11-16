/**
 * Verdi for `<input type="date">` i lokal kalenderdato (ordre 2026-11-15 (17) P4).
 * `toISOString()` gir UTC-dato og viser gårsdagen 00:00–01:00 (vinter) / 00:00–02:00 (sommer)
 * i Norge. Ren `YYYY-MM-DD` (mobilens autofyll) brukes uendret — den er alt en kalenderdato.
 */
export function datoInputVerdi(verdi: unknown): string {
  if (typeof verdi !== "string" || !verdi) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(verdi)) return verdi;
  const d = new Date(verdi);
  if (Number.isNaN(d.getTime())) return "";
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${maaned}-${dag}`;
}
