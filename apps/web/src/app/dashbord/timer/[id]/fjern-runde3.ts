/**
 * Runde 3 timer (vakttest variant A, orkestrator 2026-11-27): fjerner elementene runde 3 la til i
 * dagskortet (merket `data-runde3`) fra statisk markup, så vakttestene kan sammenligne resten med
 * markupen fra før runde 3. Hvert merket element fjernes med alt innhold (balanserte `<div>`).
 */
export function fjernRunde3(html: string): string {
  const merke = '<div data-runde3=""';
  let ut = html;
  for (let start = ut.indexOf(merke); start !== -1; start = ut.indexOf(merke)) {
    let dybde = 0;
    let i = start;
    for (;;) {
      const aapne = ut.indexOf("<div", i);
      const lukk = ut.indexOf("</div>", i);
      if (lukk === -1) throw new Error("fjernRunde3: ubalansert <div>");
      if (aapne !== -1 && aapne < lukk) {
        dybde++;
        i = aapne + 4;
      } else {
        dybde--;
        i = lukk + 6;
        if (dybde === 0) break;
      }
    }
    ut = ut.slice(0, start) + ut.slice(i);
  }
  return ut;
}
