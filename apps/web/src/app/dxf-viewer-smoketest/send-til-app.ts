/**
 * Delt mellom `page.tsx` og `error.tsx` (RETUR F1+F2 mobil, Dokgen 2026-10-17):
 * postMessage-bru til RN sin WebView (og til `window.parent` for feilsøking i en
 * vanlig iframe). Se `page.tsx`-filheaderen for hele protokollen.
 */
export function sendTilApp(data: Record<string, unknown>) {
  try {
    const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } })
      .ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify(data));
    window.parent?.postMessage(data, "*");
  } catch {
    /* RN-brua finnes ikke (f.eks. åpnet direkte i Mac-nettleser for feilsøking) */
  }
}
