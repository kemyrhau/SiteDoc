import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";

export interface BildeResultat {
  uri: string;
  filstorrelse: number;
  gpsLat?: number;
  gpsLng?: number;
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

export async function velgBilde(gpsAktivert = true): Promise<BildeResultat | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const resultat = await ImagePicker.launchImageLibraryAsync({
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
