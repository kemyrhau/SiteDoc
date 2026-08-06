// Delt «Hos»-posisjonsavledning for HMS-lista (Ordre 2.3 / Funn F+G).
//
// ÉN kilde for både segmentfilteret og «Hos»-kolonnen — ingen duplisert ball-logikk.
// Regellaget (ledd-oppbygging + aktivt ledd) kommer fra @/lib/flyt-ledd (byggLedd +
// finnAktivtIndex), som igjen delegerer til @sitedoc/shared byggPosisjonsLedd. Her
// legges kun HMS-listas bucket-klassifisering (terminal / hos deg / hos behandler /
// hos melder) oppå — viewer-relativt via mine-ider.
//
// HMS-flyten er fast 2-ledd (Melder → Behandler): behandler = siste ledd.

import { byggLedd, finnAktivtIndex, type FlytMedlem } from "@/lib/flyt-ledd";

// Terminal-statuser (speiler hms/page.tsx LUKKET_STATUSER).
const LUKKET_STATUSER = new Set(["approved", "closed", "cancelled"]);

/** Innlogget brukers flyt-identitet (fra gruppe.hentMinFlytInfo). */
export interface MineIder {
  brukerId: string;
  gruppeIder: string[];
  faggruppeIder: string[];
}

export type HosBucket = "lukket" | "deg" | "behandler" | "melder" | "utkast";

export interface HosPosisjon {
  bucket: HosBucket;
  /** Aktivt ledds visningsnavn — «Hos {aktivNavn}». Null ved terminal/uten flyt. */
  aktivNavn: string | null;
  /** Behandler-leddets (siste ledd) navn — segment-etiketten «Hos {behandlerNavn}». */
  behandlerNavn: string | null;
}

/** Rad-utsnittet avledningen trenger (Task/Checklist via hms.hentDokumenter). */
export interface HosRad {
  status: string;
  aktivPosisjon?: number | null;
  dokumentflyt?: { medlemmer: FlytMedlem[] } | null;
}

/** Holder innlogget bruker et gitt ledd? (medlemskap: bruker / gruppe / faggruppe). */
function erMineLedd(
  ledd: { brukerIder: Set<string>; gruppeIder: Set<string>; faggruppeIder: Set<string> },
  mine: MineIder,
): boolean {
  if (mine.brukerId && ledd.brukerIder.has(mine.brukerId)) return true;
  if (mine.gruppeIder.some((g) => ledd.gruppeIder.has(g))) return true;
  if (mine.faggruppeIder.some((f) => ledd.faggruppeIder.has(f))) return true;
  return false;
}

/**
 * Klassifiser en HMS-rad til «Hos»-bucket + navn. Viewer-relativt (mine-ider):
 * ballholder = innlogget bruker → «deg»; ellers om ballen står på siste (behandler-)
 * ledd → «behandler»; ellers → «melder». Terminal-status → «lukket».
 */
export function hosPosisjon(rad: HosRad, mine?: MineIder): HosPosisjon {
  const medlemmer = rad.dokumentflyt?.medlemmer ?? [];
  const ledd = byggLedd(medlemmer);
  const behandlerNavn = ledd.length > 0 ? (ledd[ledd.length - 1]?.navn ?? null) : null;

  if (LUKKET_STATUSER.has(rad.status)) {
    return { bucket: "lukket", aktivNavn: null, behandlerNavn };
  }

  // Utkast: ballen er ikke sendt ennå (status draft / uten aktiv posisjon). Egen
  // bucket → kolonnen sier «Utkast», ikke «Hos ?» (null-medlem-leddet gir tomt navn).
  const idx = finnAktivtIndex(ledd, rad.aktivPosisjon ?? null);
  const aktiv = idx >= 0 ? ledd[idx] : undefined;
  if (rad.status === "draft" || !aktiv) {
    return { bucket: "utkast", aktivNavn: null, behandlerNavn };
  }

  if (mine && erMineLedd(aktiv, mine)) {
    return { bucket: "deg", aktivNavn: aktiv.navn, behandlerNavn };
  }

  const erSisteLedd = ledd.length > 1 && idx === ledd.length - 1;
  return { bucket: erSisteLedd ? "behandler" : "melder", aktivNavn: aktiv.navn, behandlerNavn };
}
