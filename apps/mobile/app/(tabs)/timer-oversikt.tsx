import { DagsseddelListe } from "../../src/components/DagsseddelListe";

// Timer-tab (2a). Rendrer den delte dagsseddel-lista uten tilbakeknapp; trykk på
// rader/FAB pusher inn i den uendrede `app/timer/*`-stacken (valg B). Ruten heter
// `timer-oversikt` for å ikke kollidere med stackens `/timer`; tab-tittelen er
// «Timer» (satt i (tabs)/_layout.tsx).
export default function TimerTab() {
  return <DagsseddelListe />;
}
