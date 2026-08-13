# ORDRE: Fiks speilfeil i 2-punkts georeferanse (P0)

Dato: 2026-08-13 · Fra: fabel · Til: kode-Opus (via Kenneth)
Fil: `packages/shared/src/utils/georeferanse.ts` — 2-punkts-grenen i `beregnTransformasjon`

## Symptom (verifisert i felt, Lakselv lufthavn 2026-08-13)
Blå GPS-prikk på georeferert tegning vises feil — den er **speilbildet av reell
posisjon om linjen gjennom kalibreringspunkt 1 og 2**. Observert: GPS
70.067883, 24.980824 (±7m, korrekt iht. Google Maps: terminalen øst for
rullebanen) → tegning (56.4, 40.8) = vest for rullebanen.
Kalibrering: P1 (70.07422, 24.98941), P2 (70.05976, 24.93339).

## Rotårsak
2-punkts-grenen fitter en similaritetstransformasjon med rotasjonsform
`[a b; -b a]` (px = a·gx + b·gy + tx; py = −b·gx + a·gy + ty). Denne har
alltid determinant a²+b² > 0 og kan derfor kun rotere/skalere — aldri speile.
Men GPS→bilde er alltid orienterings-REVERSERENDE: latitude øker nordover,
pixel-y øker nedover. Riktig transform har negativ determinant.

Konsekvens: de to kalibreringspunktene treffes eksakt (2 punkter bestemmer
similariteten entydig), så `beregnKalibreringsFeil` viser 0 m og editoren ser
korrekt ut — men alle ANDRE posisjoner speiles om P1–P2-linjen. Med dataene
over blir b ≈ 30·a (nesten-90°-rotasjon som «erstatning» for speilingen).

3+-punkts affine-grenen rammes IKKE (full 6-parameter-fit kan speile).
Workaround inntil fiks: legg til et tredje kalibreringspunkt.

## Fiks (rotårsak, ikke plaster)
Fit similariteten mot speilet nord-akse: bruk ĝy = −lat i utledningen, og fold
speilingen inn i affine-koeffisientene slik at gy = +lat utad. Da forblir
`gpsTilTegning`/`tegningTilGps` uendret (de leser kun `affine`).

```ts
// 2-punkts-grenen: bytt gy-definisjonen
const gy1 = -point1.gps.lat;
const gy2 = -point2.gps.lat;
// a, b, tx, ty utledes som før mot (gx, ĝy)

// Utadvendte koeffisienter (gy = +lat):
// px = a·gx − b·gy + tx ; py = −b·gx − a·gy + ty
const affine = {
  a,     b: -b, c: tx,
  d: -b, e: -a, f: ty,   // det = −(a²+b²) < 0 → korrekt kiralitet
  ia, ib, ic, id, ie, if_, // MÅ reutledes fra de nye koeffisientene
};
```

Invers: med M = [a −b; −b −a] er det(M) = −(a²+b²);
ia = −a/det? — utled eksakt med standard 2×2-invers av de NYE koeffisientene,
ikke gjenbruk dagens spesialtilfelle (`ib`-fortegnet der gjelder gammel form).
Verifiser med rundtur-test.

## Krav / Definition of Done
1. Regresjonstest i shared: syntetisk nord-opp-tegning (kjent skala), to
   referansepunkter, et TREDJE kjent punkt skal lande riktig (ikke speilet),
   toleranse < 0.5 % av tegningsbredde.
2. Rundtur-test: `tegningTilGps(gpsTilTegning(p)) ≈ p` for flere p.
3. Test med de reelle Lakselv-dataene over: GPS 70.067883, 24.980824 skal
   havne øst for P1–P2-linjen (samme side som P1-nære terminalområdet).
4. Bekreft at 3+-punkts affine-grenen er uendret (eksisterende tester grønne).
5. Merk: eksisterende 2-punkts-kalibreringer i produksjon blir RIKTIGE av
   denne fiksen (samme lagrede data, korrekt transform) — ingen migrering.
6. `beregnKalibreringsFeil` kan per design ikke avdekke speilfeil ved 2
   punkter (eksakt fit). Vurder (egen sak, ikke denne ordren) en UI-hint i
   GeoReferanseEditor: «2 punkter gir eksakt fit — verifiser med Min posisjon
   eller legg til et 3. punkt».

---

## Cowork-verifisering + utledet invers (2026-08-13)

**Rotårsaken er bekreftet mot koden.** `packages/shared/src/utils/georeferanse.ts:274-276`:

```ts
const affine = { a, b, c: tx, d: -b, e: a, f: ty };
```

`det = a·e − b·d = a·a − b·(−b) = a² + b²` — alltid positiv. Modellkommentaren :219-220 sier det eksplisitt. Similariteten kan rotere og skalere, aldri speile. Siden latitude øker nordover og pixel-y nedover, må korrekt transform ha negativ determinant, og rotasjon av tegningen endrer ikke det fortegnet.

**Inversen fabel ba om utledes eksakt — svaret er enklere enn ventet.**

Med de nye koeffisientene `M = [a −b; −b −a]`:

```
det = a·(−a) − (−b)·(−b) = −(a² + b²)
```

Standard 2×2-invers gir, med `D = a² + b²`:

```
M⁻¹ = (1/det)·[−a   b ]  =  (1/D)·[ a  −b ]  =  M / D
              [ b   a ]           [−b  −a ]
```

Altså **`M⁻¹ = M / (a² + b²)`** — samme matrise delt på D. Det er ikke tilfeldig: `M/√D` er en ren refleksjonsmatrise, og refleksjoner er involutive (sin egen invers).

Verifisert `M·M⁻¹ = I`:
- rad1·kol1: `a·(a/D) + (−b)·(−b/D) = (a²+b²)/D = 1` ✅
- rad1·kol2: `a·(−b/D) + (−b)·(−a/D) = (−ab+ab)/D = 0` ✅
- rad2·kol1: `−b·(a/D) + (−a)·(−b/D) = 0` ✅
- rad2·kol2: `−b·(−b/D) + (−a)·(−a/D) = (a²+b²)/D = 1` ✅

Koeffisientene blir dermed:

```ts
const D = a * a + b * b;          // > 0
const ia =  a / D;
const ib = -b / D;
const id = -b / D;
const ie = -a / D;
const ic = -(ia * tx + ib * ty);  // translasjon: g = M⁻¹·(p − t)
const if_ = -(id * tx + ie * ty);
```

⚠️ **Merk at `ie` er negativ** der den i dagens kode er positiv (`ie = a/det`). Det er nettopp fortegnet fabel advarte mot å gjenbruke. Rundtur-testen (DoD punkt 2) fanger feil her.
