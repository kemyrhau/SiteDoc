// B10 (kort-id-spec § 11.10.2): typekolonnen i lønnsartoppsettet. Fravær viser om
// arten har tak mot dagsnormen («Fravær · med tak»), ingen egen kolonne. Markøren
// leses bare via `harNormtak` (glue-vakten, TF14).
import { harNormtak, type NormtakLonnsart } from "@sitedoc/shared";

export function lonnsartTypeEtikett(
  rad: NormtakLonnsart & { type: string },
  t: (nokkel: string) => string,
): string {
  const type = t(`firma.timer.type.${rad.type}`);
  if (rad.type !== "fravaer") return type;
  return `${type} · ${t(harNormtak(rad) ? "firma.timer.normtak.medTak" : "firma.timer.normtak.utenTak")}`;
}
