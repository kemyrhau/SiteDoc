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

async function komprimer(uri: string): Promise<{ uri: string; filstorrelse: number }> {
  // Steg 1: Skaler til maks 1920px bredde
  let resultat = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAKS_BREDDE } }],
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
      [{ resize: { width: MAKS_BREDDE } }],
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
      [{ resize: { width: MAKS_BREDDE } }],
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

async function hentGps(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const posisjon = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return { lat: posisjon.coords.latitude, lng: posisjon.coords.longitude };
  } catch {
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
