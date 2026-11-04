import type { DrawingStatus } from "../validation";

/**
 * Metadata S-pakke B-5: tegningens kildeformat. `fileType` overskrives til `svg`/`png`
 * når DWG/DXF/PDF konverteres (tegning.ts), så bare endelsen på `originalFileUrl`
 * vet hva som faktisk ble lastet opp. Uten original (eldre rader, ukonverterte filer)
 * er `fileType` selve kildeformatet. Returnerer små bokstaver, `null` når ingen av
 * delene gir en endelse.
 */
export function utledKildeformat(
  originalFileUrl: string | null | undefined,
  fileType: string | null | undefined,
): string | null {
  const fraOriginal = endelse(originalFileUrl);
  if (fraOriginal) return fraOriginal;
  const ft = fileType?.trim().toLowerCase();
  return ft ? ft : null;
}

function endelse(url: string | null | undefined): string | null {
  if (!url) return null;
  const sti = url.split(/[?#]/)[0] ?? "";
  const filnavn = sti.slice(sti.lastIndexOf("/") + 1);
  const punkt = filnavn.lastIndexOf(".");
  if (punkt <= 0 || punkt === filnavn.length - 1) return null;
  return filnavn.slice(punkt + 1).toLowerCase();
}

/** i18n-nøkkel per tegningsstatus (`DRAWING_STATUSES`). Felles for web og mobil. */
export const TEGNING_STATUS_NOEKKEL: Record<DrawingStatus, string> = {
  utkast: "tegninger.statusUtkast",
  delt: "tegninger.statusDelt",
  under_behandling: "tegninger.statusUnderBehandling",
  godkjent: "tegninger.statusGodkjent",
  for_bygging: "tegninger.statusForBygging",
  som_bygget: "tegninger.statusSomBygget",
};
