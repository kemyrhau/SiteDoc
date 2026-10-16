// Delte målefarger for tegningsvisningen — ÉN kilde for SVG-veien (`MaalingOverlay.tsx`,
// prosent-rom) og dxf-viewer-grenen (`DxfViewerTegning.tsx`, WebGL verdensrom), så de to
// visningene ikke kan drifte fra hverandre (RETUR leveranse 3+4, 2026-10-16).

/** Aktiv (valgt) måling — sitedoc-primary. */
export const MAALING_FARGE_AKTIV = "#1e40af";

/** Inaktiv/ferdig måling — slate-500. */
export const MAALING_FARGE_FERDIG = "#64748b";
