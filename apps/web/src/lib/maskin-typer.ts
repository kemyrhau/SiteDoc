/**
 * Maskintyper per kategori — kilde: docs/claude/maskin.md
 * labelKey brukes med t() ved rendering, ikke hardkod tekst i JSX.
 */

export type MaskinKategori = "kjoretoy" | "anleggsmaskin" | "smautstyr";

export interface MaskinType {
  verdi: string;
  labelKey: string;
  eksempel: string;
}

// Labels kunne vært i i18n-nøkler, men eksempel-tekst gir bedre hjelp i dropdown
export const TYPER_PER_KATEGORI: Record<MaskinKategori, MaskinType[]> = {
  kjoretoy: [
    { verdi: "personbil", labelKey: "Personbil", eksempel: "Volvo V70, Toyota Corolla" },
    { verdi: "varebil", labelKey: "Varebil", eksempel: "Toyota Hilux, VW Crafter, Mercedes Sprinter" },
    { verdi: "lastebil", labelKey: "Lastebil", eksempel: "Volvo FH16, Scania R500" },
    { verdi: "tilhenger", labelKey: "Tilhenger", eksempel: "Brenderup, Ifor Williams" },
  ],
  anleggsmaskin: [
    { verdi: "gravemaskin", labelKey: "Gravemaskin", eksempel: "CAT 320, Volvo EC220E, Komatsu PC210" },
    { verdi: "hjullaster", labelKey: "Hjullaster", eksempel: "Volvo L90, CAT 950M" },
    { verdi: "dumper", labelKey: "Dumper", eksempel: "Volvo A30G, CAT 730" },
    { verdi: "kran", labelKey: "Kran", eksempel: "Liebherr LTM 1100, Grove GMK" },
    { verdi: "komprimator_stor", labelKey: "Komprimator (stor)", eksempel: "Bomag BW213, Dynapac CA2500" },
    { verdi: "dozer", labelKey: "Dozer", eksempel: "CAT D6, Komatsu D65" },
    { verdi: "grader", labelKey: "Grader", eksempel: "CAT 140M, Volvo G946" },
    { verdi: "asfaltlegger", labelKey: "Asfaltlegger", eksempel: "Vögele Super 1800, Volvo P6820" },
    { verdi: "materialhandterer", labelKey: "Materialhåndterer", eksempel: "Fuchs MHL350, Liebherr LH 22" },
    { verdi: "boremaskin_stor", labelKey: "Boremaskin (stor)", eksempel: "Atlas Copco FlexiROC, Sandvik" },
  ],
  smautstyr: [
    { verdi: "komprimator", labelKey: "Komprimator", eksempel: "Hoppetusse, vibrasjonsplate/stampe" },
    { verdi: "aggregat", labelKey: "Aggregat", eksempel: "Honda EU22i, Atlas Copco QAS" },
    { verdi: "kompressor", labelKey: "Kompressor", eksempel: "Atlas Copco XAS, Kaeser M27" },
    { verdi: "boremaskin", labelKey: "Boremaskin", eksempel: "Hilti TE 70, Bosch GBH" },
    { verdi: "steinsag", labelKey: "Steinsag", eksempel: "Stihl TS 420, Husqvarna K770" },
    { verdi: "sveiseapparat", labelKey: "Sveiseapparat", eksempel: "Lincoln, ESAB" },
    { verdi: "laser", labelKey: "Laser", eksempel: "Leica, Topcon, Trimble" },
    { verdi: "gps_utstyr", labelKey: "GPS-utstyr", eksempel: "Trimble, Leica iCON" },
    { verdi: "stillas", labelKey: "Stillas", eksempel: "Haki, Layher" },
    { verdi: "pumpe", labelKey: "Pumpe", eksempel: "Grindex, Flygt" },
    { verdi: "annet", labelKey: "Annet", eksempel: "Fritekst — beskriv i notater" },
  ],
};
