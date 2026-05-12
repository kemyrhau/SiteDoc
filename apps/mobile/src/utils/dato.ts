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
