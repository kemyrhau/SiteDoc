// Toveis vert-bro for den delte tegnemotoren — testbar TVILLING av funksjonen
// som er inlinet i `annoterings-html.ts`. HTML-strengen kan ikke importere, så
// logikken finnes to steder; endres grenvalget her, skal det endres begge.
//
// Poenget med å teste den: RN-grenen (`window.ReactNativeWebView.postMessage`)
// og web-grenen (`window.parent.postMessage`) VELGES av miljøet, ikke av en
// flagg. En WebKit-/Safari-test treffer bare web-grenen (ingen ReactNativeWebView),
// så uten denne testen er RN-veien refaktorert og ukjørt — og feilmodusen er
// stille (annotering slutter å svare, ingen typefeil).

/** Window-lignende objekt broen kan poste til. Løs form så testen kan stubbe det. */
export interface BroVindu {
  ReactNativeWebView?: { postMessage?: (melding: string) => void };
  parent?: unknown;
  postMessage?: (melding: string, mål: string) => void;
}

/**
 * Send en melding til verten. Velger RN-WebView-broen hvis den finnes, ellers
 * iframe-broen (window.parent). Returnerer hvilken gren som ble valgt — kun for
 * testbarhet; HTML-tvillingen returnerer ingenting.
 *
 * 🔴 TVILLING: `annoterings-html.ts` `postTilVert` har IDENTISK grenvalg (uten
 * retur). Grenbetingelsene MÅ holdes like begge steder.
 */
export function postTilVert(obj: unknown, win: BroVindu): "rn" | "parent" | "ingen" {
  const melding = JSON.stringify(obj);
  if (win.ReactNativeWebView && win.ReactNativeWebView.postMessage) {
    win.ReactNativeWebView.postMessage(melding);
    return "rn";
  } else if (win.parent && win.parent !== win) {
    (win.parent as { postMessage: (m: string, t: string) => void }).postMessage(melding, "*");
    return "parent";
  }
  return "ingen";
}
