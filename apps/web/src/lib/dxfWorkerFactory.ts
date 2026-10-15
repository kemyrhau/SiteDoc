/**
 * Leser `public/workers/manifest.json` (generert av scripts/build-dxf-worker.mjs
 * FØR next dev/build) for å finne gjeldende innholds-hashede worker-bunt, og gir
 * tilbake en `workerFactory` til `dxf-viewer`s `Load({ workerFactory })`.
 * Manifestet mangler eller svarer feil → `null`: dxf-viewer-grenen faller da
 * tilbake til hovedtråden (DxfViewerTegning.tsx), aldri en blank flate.
 */
export async function hentDxfWorkerFactory(): Promise<(() => Worker) | null> {
  try {
    const res = await fetch("/workers/manifest.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const url = (data as { url?: unknown } | null)?.url;
    if (typeof url !== "string" || !url) return null;
    return () => new Worker(url);
  } catch {
    return null;
  }
}
