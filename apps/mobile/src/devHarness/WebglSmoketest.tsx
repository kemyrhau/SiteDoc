import { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

/**
 * ENGANGS-RØYKTEST (mobil leveranse 1, arbeidstegning-f1-planen): laster harness.html
 * (dxf-viewer, WebGL, fallplanens dagens prod-filer) fra en LAN-adresse i appens EKTE
 * WKWebView, for å avklare risikoen som ALDRI er målt — dxf-viewer sitt WebGL-
 * minnefotavtrykk i en WKWebView EID AV RN (annen jetsam-grense enn frittstående
 * Safari, der Gate 3-tallene ble målt).
 *
 * Bevisst IKKE en `app/`-rute (lærdom fra forrige spike, `0c3a5707`: en fil under
 * `app/` ble en ekte Expo-rute og måtte fjernes før Kontrollør-gate). Mountes i
 * stedet direkte fra `app/index.tsx` bak et miljøvariabel-flagg — se filhode der.
 * Lever kun på denne engangs-branchen, slettes etter at beviset er levert.
 */
export default function WebglSmoketest() {
  const [url, setUrl] = useState("http://192.168.1.168:8743/harness.html");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {!lastUrl ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://<lan-ip>:<port>/harness.html"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button title="Last" onPress={() => setLastUrl(url)} />
        </View>
      ) : (
        <WebView
          source={{ uri: lastUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  form: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  webview: { flex: 1 },
});
