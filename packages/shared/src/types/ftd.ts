// FTD-modul: Avviksanalyse-typer

export interface AvviksRad {
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number;
  mengdeKontrakt: number;
  mengdeDiff: number;
  sumAnbud: number;
  sumKontrakt: number;
  sumDiff: number;
  status: "Match" | "Endret" | "Ny" | "Fjernet";
}

export interface AvviksOppsummering {
  totalAnbud: number;
  totalKontrakt: number;
  totalDiff: number;
  antallMatch: number;
  antallEndret: number;
  antallNy: number;
  antallFjernet: number;
}

export interface AvviksanalyseResultat {
  rows: AvviksRad[];
  summary: AvviksOppsummering | null;
}
