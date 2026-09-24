// delaunator har ingen egne typer. Mobil typechecker @sitedoc/api transitivt
// (AppRouter), som importerer delaunator i triangulering.ts — derfor trengs denne
// ambient-deklarasjonen her også (web har sin egen i src/lib/delaunator.d.ts).
declare module "delaunator" {
  export default class Delaunator {
    constructor(coords: ArrayLike<number>);
    triangles: Uint32Array;
    halfedges: Int32Array;
    hull: Uint32Array;
    static from(points: ArrayLike<ArrayLike<number>>): Delaunator;
  }
}
