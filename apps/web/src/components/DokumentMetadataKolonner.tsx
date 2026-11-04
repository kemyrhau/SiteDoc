import {
  DATO_KOLONNER,
  PERSON_KOLONNER,
  hendelseNavn,
  hendelseVed,
  signaturKategori,
  signaturSorterVerdi,
  signaturTekst,
  utfyllingUkjent,
  type MetadataRad,
} from "@/lib/dokumentMetadata";

/**
 * Metadata M-pakke: de valgbare kolonnene «Sendt av/Sendt», «Godkjent av/Godkjent»,
 * «Lukket av/Lukket», «Sist utfylt av/Sist utfylt» og «Signatur» — felles for sjekklister og
 * oppgaver, så de to listene aldri viser eller filtrerer ulikt.
 */

export const METADATA_KOLONNE_IDER = [
  "sendtAv", "sendtDato", "godkjentAv", "godkjentDato", "lukketAv", "lukketDato",
  "sistUtfyltAv", "sistUtfylt", "signatur",
] as const;

export const METADATA_NAVN_NOKKEL: Record<(typeof METADATA_KOLONNE_IDER)[number], string> = {
  sendtAv: "tabell.sendtAv",
  sendtDato: "tabell.sendtDato",
  godkjentAv: "tabell.godkjentAv",
  godkjentDato: "tabell.godkjentDato",
  lukketAv: "tabell.lukketAv",
  lukketDato: "tabell.lukketDato",
  sistUtfyltAv: "tabell.sistUtfyltAv",
  sistUtfylt: "tabell.sistUtfylt",
  signatur: "tabell.signatur",
};

export interface MetadataKolDef<T> {
  id: string;
  header: string;
  celle: (rad: T) => JSX.Element;
  bredde?: string;
  sorterbar?: boolean;
  sorterVerdi?: (rad: T) => string | number | null;
  filtrerbar?: boolean;
  filterAlternativer?: { value: string; label: string }[];
}

const tom = <span className="text-gray-300">—</span>;

export function byggMetadataKolonner<T extends MetadataRad>(
  t: (nokkel: string) => string,
  formaterDato: (dato: string | null) => string,
  filter: Record<string, { value: string; label: string }[]>,
): Record<string, MetadataKolDef<T>> {
  const defs: Record<string, MetadataKolDef<T>> = {};
  const loggAv = () => (
    <span className="text-gray-300" title={t("metadata.endringsloggAv")}>—</span>
  );

  for (const [id, steg] of Object.entries(PERSON_KOLONNER)) {
    defs[id] = {
      id, header: t(METADATA_NAVN_NOKKEL[id as keyof typeof METADATA_NAVN_NOKKEL]),
      celle: (rad) => {
        const navn = hendelseNavn(rad, steg);
        return navn ? <span className="text-xs text-gray-600">{navn}</span> : tom;
      },
      sorterbar: true, sorterVerdi: (rad) => hendelseNavn(rad, steg),
      filtrerbar: (filter[id]?.length ?? 0) > 0, filterAlternativer: filter[id] ?? [],
    };
  }
  for (const [id, steg] of Object.entries(DATO_KOLONNER)) {
    defs[id] = {
      id, header: t(METADATA_NAVN_NOKKEL[id as keyof typeof METADATA_NAVN_NOKKEL]), bredde: "120px",
      celle: (rad) => {
        const ved = hendelseVed(rad, steg);
        return ved ? <span className="text-xs text-gray-500">{formaterDato(ved)}</span> : tom;
      },
      sorterbar: true, sorterVerdi: (rad) => { const ved = hendelseVed(rad, steg); return ved ? new Date(ved).getTime() : null; },
    };
  }
  // «Sist utfylt av»: filteret («Utfylt av») treffer alle i endringsloggen, ikke bare den siste.
  defs.sistUtfyltAv = {
    id: "sistUtfyltAv", header: t("tabell.sistUtfyltAv"),
    celle: (rad) => {
      if (utfyllingUkjent(rad)) return loggAv();
      const navn = rad.utfylling?.sist?.av.navn;
      return navn ? <span className="text-xs text-gray-600">{navn}</span> : tom;
    },
    sorterbar: true, sorterVerdi: (rad) => rad.utfylling?.sist?.av.navn ?? "",
    filtrerbar: (filter.sistUtfyltAv?.length ?? 0) > 0, filterAlternativer: filter.sistUtfyltAv ?? [],
  };
  defs.sistUtfylt = {
    id: "sistUtfylt", header: t("tabell.sistUtfylt"), bredde: "120px",
    celle: (rad) => {
      if (utfyllingUkjent(rad)) return loggAv();
      const ved = rad.utfylling?.sist?.ved ?? null;
      return ved ? <span className="text-xs text-gray-500">{formaterDato(ved)}</span> : tom;
    },
    sorterbar: true, sorterVerdi: (rad) => { const ved = rad.utfylling?.sist?.ved; return ved ? new Date(ved).getTime() : null; },
  };
  defs.signatur = {
    id: "signatur", header: t("tabell.signatur"), bredde: "100px",
    celle: (rad) => {
      const kat = signaturKategori(rad.signatur);
      if (kat === "uten") return tom;
      return (
        <span className={`text-xs font-medium ${kat === "signert" ? "text-green-700" : "text-amber-700"}`}>
          {signaturTekst(rad.signatur)}
        </span>
      );
    },
    sorterbar: true, sorterVerdi: (rad) => signaturSorterVerdi(rad.signatur),
    filtrerbar: true,
    filterAlternativer: [
      { value: "signert", label: t("signaturFilter.signert") },
      { value: "mangler", label: t("signaturFilter.mangler") },
      { value: "uten", label: t("signaturFilter.uten") },
    ],
  };
  return defs;
}
