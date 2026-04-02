import { Tabs } from "expo-router";
import { Home, MapPin, FolderOpen, Menu } from "lucide-react-native";

export default function TabsLayout() {
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
          title: "Hjem",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lokasjoner"
        options={{
          title: "Lokasjoner",
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="boks"
        options={{
          title: "Mapper",
          tabBarIcon: ({ color, size }) => (
            <FolderOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mer"
        options={{
          title: "Mer",
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
