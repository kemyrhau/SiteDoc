import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Minimal vitest-oppsett for web. `@vitejs/plugin-react` gir automatisk
 * JSX-runtime slik at testen kan importere komponent-moduler som evaluerer
 * lucide-ikoner (JSX) på modulnivå (filene importerer ikke React selv — Next
 * auto-injiserer). Node-miljø: dekningstesten leser filsystem + rene rutelister,
 * ingen DOM. `@`-alias speiler tsconfig.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
