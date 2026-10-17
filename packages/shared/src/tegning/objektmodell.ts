/**
 * O1 — felles objektmodell for arbeidstegninger (spec § 8), leveranse 1.
 *
 * Speiler `render.py` sitt `--register-world`-register 1:1 (apps/api/src/services/
 * ezdxf/render.py, `bygg_objektregister` + `register_world`-blokken) — ingen
 * oversettelse i klienten, registeret ER O1. Koordinater (`bbox`/`geom`) er i RÅ
 * DXF-verdenskoordinater (heltall, samme enhet som filens `$INSUNITS`), for en motor
 * som tegner direkte fra DXF-en (dxf-viewer/WebGL), ikke fra en SVG.
 *
 * `kilde` (spec O1) lagres IKKE som eget felt her — den er alltid utledbar fra
 * `elid`/`typeId` (til stede → Revit-XDATA fantes → "dwg-revit", ellers "dwg-lag"),
 * se `utledKilde()`. Å duplisere den som lagret felt ville vært en egen kilde til
 * drift mellom Python og TS for noe som allerede følger av dataene.
 */

export interface AttrMetaPunkt {
  x: number;
  y: number;
  h: number;
  rot: number;
}

export interface RegisterVerdenObjekt {
  /** DXF-handle (hex-streng) — stabil id innenfor én konvertering. */
  id: string;
  lag: string;
  /** DXF-entitetstype (LINE, LWPOLYLINE, HATCH, INSERT, TEXT, MTEXT, ATTRIB, ...). */
  dtype: string;
  /** Revit ElementId (kun når REVIT-XDATA fantes på entiteten). */
  elid?: string;
  /** Revit type-id (AT-F6). */
  typeId?: string;
  /** Norsk kategori — Revit BuiltInCategory, lagbeskrivelse, eller lagnavn-tolkning (i prioritert rekkefølge). */
  kategori: string;
  /** Blokknavn (kun på INSERT). */
  blokk?: string;
  /** ATTRIB-verdier pr. tag (kun på INSERT med attributter). */
  attr?: Record<string, string>;
  /** Egen posisjon/høyde/rotasjon pr. ATTRIB, i DXF-verdenskoordinater — INSERT-ens
   * samlede bbox dekker hele blokken, ikke der teksten faktisk sitter. */
  attrMeta?: Record<string, AttrMetaPunkt>;
  /** F1 felt 5: egen tekst-innhold for frittstående TEXT/MTEXT (ATTRIB-tekst ligger i `attr`). */
  tekst?: string;
  /** Materiale fra skravurmønster (kjent mapping). */
  materiale?: string;
  /** Rått skravurmønsternavn (ukjent mapping, ikke SOLID/FP_-nummer). */
  materialeRaa?: string;
  /** Linjetype når forskjellig fra lagets (BYLAYER). */
  linjetype?: string;
  /** Lagets egen linjetype (kan være tom streng). */
  lagLinjetype: string;
  /** Lagets lineweight (mm×100, DXF-konvensjon), null = ukjent/standard. */
  lagLw?: number | null;
  /** "rives" (demolert lag/linjetype) eller "nytt" ("Nye konstruksjoner" i lagnavnet). */
  status?: "rives" | "nytt";
  /** Bounding box i rå DXF-verdenskoordinater, heltall: [minX, minY, maxX, maxY]. */
  bbox?: [number, number, number, number];
  /** Ekte geometri pr. primitiv (RDP-forenklet ±2 mm), heltall, flate array pr.
   * polylinje [x0,y0,x1,y1,...] — treffetesten bruker denne (avstand punkt→segment/bue),
   * ikke bbox-kanten. Fravær (skravur/HATCH uten kontur) = treff kun via containment. */
  geom?: number[][];
  /** F1 felt 5b (AT-F10/A12/A14): tolket nærmeste TEXT/MTEXT/ATTRIB på et tekstlag
   * for rør/kabel uten egen tekst — ALDRI objektets egen verdi, alltid vist merket
   * «(nærmeste merking)». Fravær = ingen tekst innen grensen (negativkontroll A12). */
  naermesteMerking?: string;
}

export interface RegisterVerdenLagInfo {
  navn: string;
  antall: number;
  visningsnavn: string;
  desc: string;
  aci: number | null;
  ltype: string;
  lw: number | null;
  /** F2-gruppe (grupperingsnøkkel): dominant Revit-kategori blant lagets objekter
   * når XDATA finnes, ellers NS 3451/AIA/SOSI-prefiks fra lagnavnet, ellers "Andre". */
  gruppe: string;
  /** F2-visningsnavn (RETUR F1+F2 web, 2026-10-17): menneskelesbart navn for
   * `gruppe` — Revit-kategorien selv, NS 3451-/AIA-tabellnavnet, eller "Andre"
   * når koden er ukjent (SOSI, ArchiCAD-interne lagkoder). `gruppe` kan vises
   * separat foran som rå kode (grå), se LagPanel.tsx. */
  gruppeNavn: string;
}

export interface RegisterVerden {
  fil: string;
  koordsys: string;
  antallObjekter: number;
  antallLag: number;
  antallElid: number;
  objekter: Record<string, RegisterVerdenObjekt>;
  /** Revit ElementId → liste av handles (ett element kan bestå av flere DXF-entiteter). */
  elidIndex: Record<string, string[]>;
  laginventar: RegisterVerdenLagInfo[];
}

/** O1 § 8 sin `kilde`-klassifisering, utledet (ikke lagret — se filkommentar). */
export function utledKilde(o: Pick<RegisterVerdenObjekt, "elid" | "typeId">): "dwg-revit" | "dwg-lag" {
  return o.elid !== undefined || o.typeId !== undefined ? "dwg-revit" : "dwg-lag";
}

/** Lett form-sjekk av et innlest register-world.json — IKKE en fullstendig
 * skjemavalidering (filen er server-generert, ikke brukerinput). Fanger den vanligste
 * feilklassen (feil fil/tom respons) før klienten later som den har et gyldig register. */
export function erGyldigRegisterVerden(verdi: unknown): verdi is RegisterVerden {
  if (!verdi || typeof verdi !== "object") return false;
  const v = verdi as Record<string, unknown>;
  return (
    typeof v.antallObjekter === "number" &&
    typeof v.objekter === "object" &&
    v.objekter !== null &&
    Array.isArray(v.laginventar)
  );
}
