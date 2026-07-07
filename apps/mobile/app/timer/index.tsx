import { DagsseddelListe } from "../../src/components/DagsseddelListe";

// Timer-stackens index. Selve lista er ekstrahert til `DagsseddelListe` og deles
// med den nye Timer-tab-en (2a). `medTilbakeknapp` bevarer dagens `/timer`-visning
// byte-tilsvarende (header med ArrowLeft).
export default function TimerListeSide() {
  return <DagsseddelListe medTilbakeknapp />;
}
