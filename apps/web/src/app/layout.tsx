import type { Metadata } from "next";
import { Providers } from "./providers";
import { TestpanelPort } from "@/components/testpanel/TestpanelPort";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteDoc",
  description: "Rapport- og kvalitetsstyringssystem for byggeprosjekter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <TestpanelPort />
      </body>
    </html>
  );
}
