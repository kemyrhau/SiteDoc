import { Platform } from "react-native";

// Ordre 2026-11-14 (9): «Fra oppmøtested» på «+ Reise» husker siste valg PÅ
// ENHETEN, pr. firma. Samme plattform-mønster som `lagSynlighetLagring.ts`
// (SecureStore native / localStorage web) — AsyncStorage er ikke installert.
// Feiler lagringen, faller valget tilbake til «ingenting valgt» (aldri gjetting).

function noekkel(organizationId: string): string {
  return `sitedoc_reise_oppmotested_${organizationId}`;
}

export async function hentSisteReiseOppmotested(organizationId: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(noekkel(organizationId));
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(noekkel(organizationId));
  } catch {
    return null;
  }
}

export async function lagreSisteReiseOppmotested(
  organizationId: string,
  oppmotestedId: string,
): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(noekkel(organizationId), oppmotestedId);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(noekkel(organizationId), oppmotestedId);
  } catch {
    // Ikke kritisk: neste gang er ingenting forhåndsvalgt.
  }
}
