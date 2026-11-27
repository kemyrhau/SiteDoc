import dynamic from "next/dynamic";
import { createElement, type FunctionComponent } from "react";

/**
 * Porten til testpanelet (lokal-dev.md § 7). Vilkåret står DIREKTE i ternæren med
 * literal env-oppslag: Next bytter dem ut med konstanter ved bygg, og webpack hopper
 * over den døde grenen før `import()` legges i modulgrafen — panel-chunken lages
 * ikke i prod. Ikke flytt vilkåret ut i en variabel eller funksjon: målt 2026-11-27
 * at `const PÅ = …; PÅ ? … : null` lot panelet bli med i prod-bundelen.
 */
const Panel =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SITEDOC_TESTPANEL === "1"
    ? dynamic(() => import("./Testpanel").then((m) => m.Testpanel))
    : null;

export function TestpanelPort() {
  // createElement i stedet for JSX: vakttesten bytter NODE_ENV, og JSX-runtimen er cachet fra før.
  // Casten bygger bro over at next/dynamic er typet mot en annen @types/react-kopi.
  return Panel ? createElement(Panel as unknown as FunctionComponent) : null;
}
