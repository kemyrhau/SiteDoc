import { Tabs } from "expo-router";
import { Home, MapPin, FolderOpen, Menu, Layers, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useNyNavigasjon } from "../../src/hooks/useNyNavigasjon";

export default function TabsLayout() {
  const { t } = useTranslation();
  const nyNav = useNyNavigasjon();

  // Flagg PÅ: Hjem · Tegninger · Dokumenter · Timer · Mer.
  // Flagg AV: Hjem · Lokasjoner · Mapper · Mer (eksakt dagens UI).
  // Alle skjermer forblir montert; `href: null` skjuler dem kun fra tab-baren
  // (fortsatt nåbare via router.push til paritet er verifisert).
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
          href: nyNav ? undefined : null,
          tabBarIcon: ({ color, size }) => <Layers size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lokasjoner"
        options={{
          title: t("nav.lokasjoner"),
          href: nyNav ? null : undefined,
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="boks"
        options={{
          title: nyNav ? t("nav.dokumenter") : t("nav.mapper"),
          tabBarIcon: ({ color, size }) => (
            <FolderOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timer-oversikt"
        options={{
          title: t("nav.timer"),
          href: nyNav ? undefined : null,
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
