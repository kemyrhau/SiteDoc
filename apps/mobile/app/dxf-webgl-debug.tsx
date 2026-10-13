import { useState } from "react";
import { View, TextInput, Button, StyleSheet, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Skjult debug-rute, leveranse 0,5 (arbeidstegning-f1): laster harness-v3.html (dxf-viewer,
 * WebGL) fra en LAN-adresse i appens WKWebView, for å avklare om dxf-viewer kjører akseptabelt
 * i WKWebView (minne, WebGL-kontekst). Ikke lenket fra noe menypunkt. Ingen EAS-bygg/OTA.
 */
export default function DxfWebglDebug() {
  const [url, setUrl] = useState("http://192.168.1.168:8743/harness-v3.html");
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {!lastUrl ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://<lan-ip>:<port>/harness-v3.html"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  form: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  webview: { flex: 1 },
});
