import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";

export interface BildeResultat {
  uri: string;
  filstorrelse: number;
  gpsLat?: number;
  gpsLng?: number;
  // Når bildet ble TATT (EXIF DateTimeOriginal), ikke når det ble lagt i appen.
  // ISO-streng ved treff; `null` når bildet ikke bar EXIF-tid (skjermbilde,
  // strippet ved deling) — et tomt felt er sant, innleggingstid ville vært løgn.
  // `undefined` betyr «ikke målt» (f.eks. kamerabilder, som stemples i UI-laget).
  opptakTidspunkt?: string | null;
}

/**
 * EXIF `DateTimeOriginal` → ISO-streng. EXIF-formatet er «YYYY:MM:DD HH:MM:SS»
 * (kolon også i datoen, ingen tidssone) og er veggklokke-tid på opptaksstedet.
 * Vi tolker den i ENHETENS lokale tidssone her på mobilen — for en norsk
 * anleggsarbeider er det byggeplassens sone, og `.toISOString()` gir da riktig
 * UTC-øyeblikk som PDF/app formaterer tilbake til samme veggklokke (PDF låser
 * «Europe/Oslo»). Samme prinsipp som tidssone-vedtaket 2026-09-03: tidspunktet
 * er et faktum om hendelsen, ikke presentasjon.
 * Returnerer `null` når EXIF-tid mangler eller er uparsbar — aldri innleggingstid.
 */
export function exifOpptakTidspunkt(exif: Record<string, unknown> | null | undefined): string | null {
  const rå = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  if (typeof rå !== "string") return null;
  const m = rå.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, år, mnd, dag, t, min, s] = m;
  const d = new Date(Number(år), Number(mnd) - 1, Number(dag), Number(t), Number(min), Number(s));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * EXIF GPS → { lat, lng } i desimalgrader, eller `null`.
 *
 * 🔴 UAVKLART FORM (måles av Kenneth på ekte iOS 26, jf. ordren): iOS/expo kan gi
 * GPS enten flatt (`GPSLatitude` + `GPSLatitudeRef`) eller nøstet (`GPS.Latitude`).
 * Denne leser BEGGE former og bruker Ref (N/S/E/W) til fortegn. Verdien måles og
 * bekreftes før vi stoler på den.
 *
 * Merk: PHPicker (uten full bibliotektilgang) STRIPPER ofte GPS av personvern.
 * Skjer det, returnerer denne `null` → galleribildet får tomt opptakssted. Det er
 * et akseptert utfall (Kenneth 2026-09-04) — vi ber IKKE om bredere tilgang.
 */
export function exifOpptakPosisjon(
  exif: Record<string, unknown> | null | undefined,
): { lat: number; lng: number } | null {
  if (!exif) return null;
  const gpsObj = (exif.GPS && typeof exif.GPS === "object" ? exif.GPS : exif) as Record<string, unknown>;

  const tallFra = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  let lat = tallFra(gpsObj.GPSLatitude ?? gpsObj.Latitude);
  let lng = tallFra(gpsObj.GPSLongitude ?? gpsObj.Longitude);
  if (lat == null || lng == null) return null;

  const latRef = String(gpsObj.GPSLatitudeRef ?? gpsObj.LatitudeRef ?? "").toUpperCase();
  const lngRef = String(gpsObj.GPSLongitudeRef ?? gpsObj.LongitudeRef ?? "").toUpperCase();
  if (latRef === "S") lat = -Math.abs(lat);
  if (lngRef === "W") lng = -Math.abs(lng);

  // Utenfor gyldig intervall = søppel, ikke posisjon.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Diagnostikk (kun __DEV__): logg rå EXIF så Kenneth kan måle nøkkelnavn/form på ekte iOS. */
function loggExifDiag(kilde: string, exif: Record<string, unknown> | null | undefined): void {
  if (!__DEV__) return;
  const gpsNøkler = exif
    ? Object.keys(exif).filter((k) => /gps/i.test(k) || /date/i.test(k))
    : [];
  console.log(
    `[EXIF-DIAG] ${kilde}`,
    JSON.stringify({
      harExif: !!exif,
      alleNøkler: exif ? Object.keys(exif) : null,
      tid_ogsted_nøkler: gpsNøkler,
      DateTimeOriginal: exif?.DateTimeOriginal ?? null,
      GPS: exif?.GPS ?? null,
      GPSLatitude: exif?.GPSLatitude ?? null,
      GPSLatitudeRef: exif?.GPSLatitudeRef ?? null,
      GPSLongitude: exif?.GPSLongitude ?? null,
      GPSLongitudeRef: exif?.GPSLongitudeRef ?? null,
      tolketTid: exifOpptakTidspunkt(exif),
      tolketPosisjon: exifOpptakPosisjon(exif),
    }),
  );
}

const MAKS_BREDDE = 1920;
const MAL_MAKS_KB = 400;
const MAL_MIN_KB = 300;
const MAL_FORHOLD = 5 / 4; // 1.25 — bredde:høyde

/** Beregn 5:4 senter-crop action basert på bildedimensjoner */
function beregnCropAction(
  bredde: number,
  hoyde: number,
): ImageManipulator.Action | null {
  const bildForhold = bredde / hoyde;
  if (Math.abs(bildForhold - MAL_FORHOLD) < 0.01) return null; // Allerede 5:4

  if (bildForhold > MAL_FORHOLD) {
    // Bredere enn 5:4 — crop sidene
    const nyBredde = Math.round(hoyde * MAL_FORHOLD);
    return {
      crop: {
        originX: Math.round((bredde - nyBredde) / 2),
        originY: 0,
        width: nyBredde,
        height: hoyde,
      },
    };
  } else {
    // Høyere enn 5:4 — crop topp/bunn
    const nyHoyde = Math.round(bredde / MAL_FORHOLD);
    return {
      crop: {
        originX: 0,
        originY: Math.round((hoyde - nyHoyde) / 2),
        width: bredde,
        height: nyHoyde,
      },
    };
  }
}

export async function komprimer(uri: string): Promise<{ uri: string; filstorrelse: number }> {
  // Steg 0: Hent bildedimensjoner for 5:4 crop
  const dimensjoner = await ImageManipulator.manipulateAsync(uri, [], {});
  const cropAction = beregnCropAction(dimensjoner.width, dimensjoner.height);
  const actions: ImageManipulator.Action[] = [];
  if (cropAction) actions.push(cropAction);
  actions.push({ resize: { width: MAKS_BREDDE } });

  // Steg 1: Crop til 5:4 + skaler til maks 1920px bredde
  let resultat = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Sjekk størrelse
  let info = await FileSystem.getInfoAsync(resultat.uri);
  let storrelseKB = info.exists && "size" in info ? info.size / 1024 : 0;

  // Steg 2: Iterativt reduser kvalitet til innenfor mål
  let kvalitet = 0.7;
  while (storrelseKB > MAL_MAKS_KB && kvalitet >= 0.1) {
    resultat = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: kvalitet, format: ImageManipulator.SaveFormat.JPEG },
    );
    info = await FileSystem.getInfoAsync(resultat.uri);
    storrelseKB = info.exists && "size" in info ? info.size / 1024 : 0;
    kvalitet -= 0.1;
  }

  // Hvis for liten, prøv litt høyere kvalitet
  if (storrelseKB < MAL_MIN_KB && kvalitet < 0.7) {
    const mellomKvalitet = kvalitet + 0.15;
    const mellomResultat = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: mellomKvalitet, format: ImageManipulator.SaveFormat.JPEG },
    );
    const mellomInfo = await FileSystem.getInfoAsync(mellomResultat.uri);
    const mellomKB = mellomInfo.exists && "size" in mellomInfo ? mellomInfo.size / 1024 : 0;
    if (mellomKB <= MAL_MAKS_KB) {
      return { uri: mellomResultat.uri, filstorrelse: mellomKB * 1024 };
    }
  }

  return { uri: resultat.uri, filstorrelse: storrelseKB * 1024 };
}

export async function hentGps(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[GPS] Tillatelse ikke gitt:", status);
      return null;
    }

    // Timeout: prøv High først (5s), fall tilbake til Balanced
    const posisjon = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (!posisjon) {
      console.warn("[GPS] High accuracy timet ut, prøver Balanced...");
      const fallback = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (!fallback) {
        console.warn("[GPS] Balanced også timet ut");
        return null;
      }
      console.log("[GPS] Balanced OK:", fallback.coords.latitude.toFixed(4), fallback.coords.longitude.toFixed(4));
      return { lat: fallback.coords.latitude, lng: fallback.coords.longitude };
    }

    console.log("[GPS] High OK:", posisjon.coords.latitude.toFixed(4), posisjon.coords.longitude.toFixed(4));
    return { lat: posisjon.coords.latitude, lng: posisjon.coords.longitude };
  } catch (feil) {
    console.warn("[GPS] Feil:", feil instanceof Error ? feil.message : feil);
    return null;
  }
}

export async function taBilde(gpsAktivert = true): Promise<BildeResultat | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;

  const resultat = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
  });

  if (resultat.canceled || !resultat.assets[0]) return null;

  const komprimert = await komprimer(resultat.assets[0].uri);
  let gps: { lat: number; lng: number } | null = null;
  if (gpsAktivert) {
    gps = await hentGps();
  }

  return {
    uri: komprimert.uri,
    filstorrelse: komprimert.filstorrelse,
    gpsLat: gps?.lat,
    gpsLng: gps?.lng,
  };
}

/**
 * Velg flere bilder fra galleriet i ETT grep. `orderedSelection: true` gir trykk-
 * rekkefølgen (iOS) i stedet for bibliotekets rekkefølge — slik at `bildeNr` følger
 * rekkefølgen brukeren trykker bildene i, ikke opptakstidspunktet.
 *
 * `maksAntall` er selectionLimit (10 som default — ubegrenset valg over mobilnett
 * fyller opplastingskøen). Returnerer array i assets-rekkefølgen, som ER trykk-
 * rekkefølgen når orderedSelection er satt — output-indeks = input-indeks.
 *
 * Opptaks-metadata (endret 2026-09-04): tid OG sted leses fra bildets EXIF PER
 * bilde (`exif: true`) — ikke lenger enhetens posisjon ved valg, som var feil for
 * galleribilder (opptak ≠ innlegging). `komprimer()` stripper EXIF fra fila, men vi
 * leser `asset.exif` fra picker-objektet FØR komprimering, så det spiller ingen
 * rolle. Mangler EXIF (tid og/eller sted), blir feltet tomt — aldri fylt med
 * innleggings-verdi. `gpsAktivert=false` (personvern) slår av sted-lesing også.
 *
 * Android-forbehold: `orderedSelection` er dokumentert iOS-only. På Android kan Photo
 * Picker returnere bibliotek-rekkefølge — ikke verifisert her.
 */
export async function velgBilder(
  maksAntall = 10,
  gpsAktivert = true,
  // Fremdrift per ferdig-komprimert bilde — lar UI vise «Behandler bilde i/N»
  // gjennom hele den sekvensielle jobben (10 bilder × ~7 native kall tar tid).
  onFremdrift?: (ferdig: number, total: number) => void,
): Promise<BildeResultat[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return [];

  const resultat = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: maksAntall,
    exif: true,
  });

  if (resultat.canceled || resultat.assets.length === 0) return [];

  // Sekvensiell komprimering med per-bilde-isolasjon — IKKE Promise.all.
  // Promise.all var alt-eller-intet: ett bilde som feiler (eller minnespress fra
  // N × ~7 native ImageManipulator-kall samtidig) forkastet HELE batchen. Nå
  // hoppes et feilende bilde over, resten overlever. Rekkefølge bevart.
  const resultater: BildeResultat[] = [];
  for (let i = 0; i < resultat.assets.length; i++) {
    try {
      const asset = resultat.assets[i]!;
      const exif = asset.exif as Record<string, unknown> | null | undefined;
      loggExifDiag(`galleri ${i + 1}/${resultat.assets.length}`, exif);
      const opptakTidspunkt = exifOpptakTidspunkt(exif);
      const posisjon = gpsAktivert ? exifOpptakPosisjon(exif) : null;
      const komprimert = await komprimer(asset.uri);
      resultater.push({
        uri: komprimert.uri,
        filstorrelse: komprimert.filstorrelse,
        gpsLat: posisjon?.lat,
        gpsLng: posisjon?.lng,
        opptakTidspunkt,
      });
    } catch (feil) {
      console.warn(
        `[BILDE] Komprimering feilet for bilde ${i + 1}/${resultat.assets.length}, hopper over:`,
        feil instanceof Error ? feil.message : feil,
      );
    }
    onFremdrift?.(i + 1, resultat.assets.length);
  }

  return resultater;
}

/** Tynn wrapper — ett bilde (TilleggSeksjon/UtleggSeksjon: ett bilde per utlegg). */
export async function velgBilde(gpsAktivert = true): Promise<BildeResultat | null> {
  return (await velgBilder(1, gpsAktivert))[0] ?? null;
}
