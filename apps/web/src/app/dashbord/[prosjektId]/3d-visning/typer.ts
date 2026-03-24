/* ------------------------------------------------------------------ */
/*  Typer for 3D-visning                                                */
/* ------------------------------------------------------------------ */

export type Fane = "3d-modell" | "overflater" | "kutt-fyll";

export interface TegningRad {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  ifcMetadata: unknown;
  building: { id: string; name: string } | null;
}

export interface EgenskapVerdi {
  value: unknown;
  type?: string;
}

export interface EgenskapGruppe {
  navn: string;
  egenskaper: Record<string, EgenskapVerdi>;
}

export interface ValgtObjekt {
  localId: number;
  modelId: string;
  kategori: string | null;
  attributter: Record<string, EgenskapVerdi>;
  relasjoner: EgenskapGruppe[];
}

export interface TreNode {
  category: string | null;
  localId: number | null;
  children?: TreNode[];
  utvidet?: boolean;
}

export interface PunktSkyRad {
  id: string;
  name: string;
  fileType: string;
  pointCount: number | null;
  conversionStatus: string;
  conversionError: string | null;
  potreeUrl: string | null;
  hasClassification: boolean;
  hasRgb: boolean;
  classifications: unknown;
  boundingBox: unknown;
  building: { id: string; name: string } | null;
}

export interface KlassifiseringRad {
  kode: number;
  navn: string;
  antall: number;
}

export type Fargemodus = "klassifisering" | "rgb" | "intensitet" | "hoyde";

export interface SkjultObjekt {
  modelId: string;
  localId: number;
  kategori: string;
  navn: string;
}

export interface AktivtFilter {
  type: "kategori" | "type" | "lag" | "system";
  verdi: string;
}

export interface OverflateData {
  id: string;
  navn: string;
  kilde: "landxml" | "punktsky";
  vertices: Float64Array;
  triangles: Uint32Array;
  bbox: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}

export interface ModellStatus {
  id: string;
  synlig: boolean;
  laster: boolean;
  feil: string | null;
}

export interface KuttFyllResultatType {
  kuttVolum: number;
  fyllVolum: number;
  netto: number;
  diffGrid: Float32Array;
  gridBredde: number;
  gridHoyde: number;
  origoX: number;
  origoY: number;
  celleStr: number;
  minDiff: number;
  maxDiff: number;
}

/** Imperativ API for 3D-vieweren */
export interface ViewerAPI {
  toggleModell: (tegningId: string, synlig: boolean) => void;
  fjernAlleKlippeplan: () => void;
  settKlipperSynlig: (synlig: boolean) => void;
  skjulObjekt: (modelId: string, localId: number) => Promise<void>;
  visObjekt: (modelId: string, localId: number) => Promise<void>;
  skjulAlleAvKategori: (kategoriKode: number) => Promise<void>;
  visAlleAvKategori: (kategoriKode: number) => Promise<void>;
  skjulAlleAvLag: (lagNavn: string) => Promise<void>;
  visAlleAvLag: (lagNavn: string) => Promise<void>;
  skjulAlleAvSystem: (systemNavn: string) => Promise<void>;
  visAlleAvSystem: (systemNavn: string) => Promise<void>;
  /** Fly kamera til et 3D-punkt. etasjeInfo for riktig Y-beregning */
  flyTil: (x: number, y: number, z: number, etasjeInfo?: { gulvMm: number; takMm: number }) => void;
  /** Hent siste klikk-punkt i 3D (for tegning-synk) */
  sisteKlikkPunkt: () => { x: number; y: number; z: number } | null;
  /** Sett horisontale klippeplan for etasjefiltrering (Y-akse i Three.js) */
  settEtasjeKlipp: (nedre: number, øvre: number) => void;
  /** Fjern etasje-klippeplan */
  fjernEtasjeKlipp: () => void;
}
