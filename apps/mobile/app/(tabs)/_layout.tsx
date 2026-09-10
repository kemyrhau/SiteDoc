import { Tabs } from "expo-router";
import { Home, MapPin, FolderOpen, Menu, Layers, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useFirmamodulSkjult } from "../../src/hooks/useFirmamodul";

export default function TabsLayout() {
  const { t } = useTranslation();
  // Firmatak-gate: er Timer deaktivert for firmaet, skal fanen ikke tilbys
  // (fail-open — se useFirmamodulSkjult). Prosjektmodul-fanene er urørt.
  const timerSkjult = useFirmamodulSkjult("timer");

  // Faner: Hjem · Tegninger · Dokumenter · Timer · Mer.
  // Lokasjoner-skjermen forblir montert (`href: null`) — den er
  // tegningsåpneren, nådd via router.push fra Tegninger-lista (aapneTegning).
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1e40af",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="hjem"
        options={{
          title: t("nav.hjem"),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tegninger"
        options={{
          title: t("nav.tegninger"),
          tabBarIcon: ({ color, size }) => <Layers size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lokasjoner"
        options={{
          title: t("nav.lokasjoner"),
          // 🔴 Fabel-lås: skjult fane, fortsatt montert og rutbar. Lokasjoner er
          // tegningsåpneren (aapneTegning fra Tegninger-lista). Slettes ikke.
          href: null,
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="boks"
        options={{
          title: t("nav.dokumenter"),
          tabBarIcon: ({ color, size }) => (
            <FolderOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timer-oversikt"
        options={{
          title: t("nav.timer"),
          href: !timerSkjult ? undefined : null,
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mer"
        options={{
          title: t("nav.mer"),
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
