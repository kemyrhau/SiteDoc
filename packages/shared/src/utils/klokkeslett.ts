/**
 * O15 pkt 3 (K4, Kenneth 2026-11-22: «del ved kl 10 var ikke akseptert, må skrives rett»):
 * tolker vanlige skrivemåter av et klokkeslett og gir det som TT:MM.
 *
 * Godtar «10» → 10:00, «9» → 09:00, «930» → 09:30, «1030» → 10:30 og «10.30», «10,30»,
 * «10:30» → 10:30. Etter skilletegnet må minuttene ha to sifre («10.3» avvises — kan bety
 * 10:03 eller 10:30). Timer 0–23, minutter 0–59. Kan teksten ikke tolkes: `null`.
 */
export function tolkKlokkeslett(tekst: string): string | null {
  const s = tekst.trim();
  let t: number;
  let m: number;
  const medSkille = /^(\d{1,2})[.,:](\d{2})$/.exec(s);
  if (medSkille) {
    t = Number(medSkille[1]);
    m = Number(medSkille[2]);
  } else if (/^\d{1,2}$/.test(s)) {
    t = Number(s);
    m = 0;
  } else if (/^\d{3,4}$/.test(s)) {
    t = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else {
    return null;
  }
  if (t > 23 || m > 59) return null;
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
