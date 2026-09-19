import { noeytralEtikett, type BadgeVariant } from "@sitedoc/shared";

/**
 * Ren (RN-fri) status-farge-logikk for mobil — testes i mobil-harnessen.
 *
 * Dokumentstatusene utledes fra `noeytralEtikett` i `@sitedoc/shared` (samme kilde
 * som web-`StatusBadge`), så mobil og web ikke kan drifte fra hverandre
 * (designnotat-statusfarger-paritet § 3/§ 8). Mobil hadde egne farger — indigo for
 * `received`/`in_progress` og lilla for `responded` — som ikke finnes på web; de
 * forsvinner her. `in_progress` heter «Under arbeid» for alle (Runde-2-«Mottatt»
 * overstyrt), `responded` er blå nøytralt.
 *
 * `VARIANT_KLASSE` speiler web-`Badge` (`packages/ui/src/badge.tsx`) NØYAKTIG:
 * fem farger, 100-bakgrunn og 700/800-tekst. Endres web-`Badge`, endres dette.
 */
const VARIANT_KLASSE: Record<BadgeVariant, { bg: string; tekstFarge: string }> = {
  default: { bg: "bg-gray-100", tekstFarge: "text-gray-700" },
  primary: { bg: "bg-blue-100", tekstFarge: "text-blue-700" },
  success: { bg: "bg-green-100", tekstFarge: "text-green-700" },
  warning: { bg: "bg-yellow-100", tekstFarge: "text-yellow-800" },
  danger: { bg: "bg-red-100", tekstFarge: "text-red-700" },
};

/**
 * Statuser utenfor dokumentflyt-modellen som `noeytralEtikett` ikke dekker.
 * Kun legacy `rejected` (F3 merget inn i `in_progress`; `dismissed` er kanonisk
 * «Avvist») er relevant på mobil-listene — systemstatusene (`active` osv.) vises
 * ikke der.
 */
const IKKE_FLYT: Record<string, { noekkel: string; variant: BadgeVariant }> = {
  rejected: { noekkel: "status.avvist", variant: "danger" },
};

/** NativeWind-klasser for en badge-variant (delt med `perspektiv`-grenen i StatusMerkelapp). */
export function variantKlasse(variant: BadgeVariant): { bg: string; tekstFarge: string } {
  return VARIANT_KLASSE[variant];
}

/**
 * Nøytral merkelapp-info for en status: i18n-nøkkel + NativeWind-klasser.
 * Brukes av `StatusMerkelapp` (badge) og `StatusFilterRad` (filter-chip) så
 * fargespråket er ett sted. Ukjent status → grå + status-strengen selv (samme
 * fallback som web og som `noeytralEtikett`).
 */
export function statusMerkelappInfo(status: string): {
  noekkel: string;
  bg: string;
  tekstFarge: string;
} {
  const egen = IKKE_FLYT[status];
  if (egen) {
    return { noekkel: egen.noekkel, ...VARIANT_KLASSE[egen.variant] };
  }
  const n = noeytralEtikett(status);
  return { noekkel: n.etikettKey, ...VARIANT_KLASSE[n.variant] };
}
