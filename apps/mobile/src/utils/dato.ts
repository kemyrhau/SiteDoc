export function formatNorskDato(iso: string): string {
  return new Date(iso).toLocaleDateString("no-NB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatTidspunkt(iso: string): string {
  return new Date(iso).toLocaleString("no-NB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Kort opptaks-tid for bildetekst under 72px-thumbnail: «27.08 13:11».
 * Numerisk og entydig (ingen forkortelse som kan misforstås), holder seg på én
 * linje i den trange filmrullen. Bruker enhetens lokale tid — for en norsk bruker
 * er det byggeplassens veggklokke, samme som PDF viser via Europe/Oslo.
 */
export function formatOpptakKort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${min}`;
}

export function isoTidspunktTilHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
