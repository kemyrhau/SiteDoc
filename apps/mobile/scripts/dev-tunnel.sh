#!/bin/bash
# Dev-tunnel: Starter Expo + ngrok v3 tunnel
# Gir stabil HTTPS-URL for mobiltesting fra ethvert nettverk
#
# Bruk: pnpm dev:tunnel (fra apps/mobile/)
# Krav: ngrok v3 installert (brew install ngrok) + ngrok-konto konfigurert

set -e

EXPO_PORT=8081

# Sjekk at ngrok er installert
if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok er ikke installert. Kjør: brew install ngrok"
  exit 1
fi

# Sjekk at ngrok er autentisert
if ! ngrok config check &> /dev/null; then
  echo "❌ ngrok er ikke konfigurert. Kjør: ngrok config add-authtoken <din-token>"
  exit 1
fi

# Drep eventuelle eksisterende ngrok-prosesser
pkill -f "ngrok http" 2>/dev/null || true

# Start ngrok i bakgrunnen
echo "🔗 Starter ngrok-tunnel på port $EXPO_PORT..."
ngrok http $EXPO_PORT --log=stdout --log-level=warn &
NGROK_PID=$!

# Vent på at ngrok-tunnelen er klar
sleep 2

# Hent ngrok-URL fra API
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
  echo "❌ Kunne ikke hente ngrok-URL. Sjekk at ngrok startet riktig."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

echo ""
echo "✅ ngrok-tunnel aktiv: $NGROK_URL"
echo "📱 Åpne denne URL-en i Expo Go på telefonen:"
echo "   exp+sitedoc://expo-development-client/?url=${NGROK_URL}"
echo ""
echo "   Eller skann QR-koden fra Expo nedenfor."
echo ""

# Rydd opp ngrok ved avslutning
cleanup() {
  echo ""
  echo "🛑 Stopper ngrok..."
  kill $NGROK_PID 2>/dev/null
  wait $NGROK_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

# Start Expo med ngrok-URL som origin
EXPO_PACKAGER_PROXY_URL="$NGROK_URL" npx expo start --clear
