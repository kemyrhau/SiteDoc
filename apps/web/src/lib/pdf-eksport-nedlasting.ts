/**
 * Nedlasting for timerapportens PDF-eksport (ordre (34)).
 *
 * Ren hjelper utenfor siden, så den testes uten den (`__tests__/pdf-eksport-nedlasting.test.ts`).
 * Bekreftelsen med filnavn og meldingen om tomt utvalg vises av `rapport/page.tsx`.
 */

/** Hvor lenge blob-URL-en lever etter klikket. Nettleseren må rekke å starte
 *  nedlastingen; å trekke URL-en tilbake i samme tikk kan avbryte den (Safari/WebKit). */
const BLOB_LEVETID_MS = 30_000;

/** Last ned base64-PDF fra pdfEksport-prosedyren. */
export function lastNedBase64(base64: string, filnavn: string, mime: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), BLOB_LEVETID_MS);
}
