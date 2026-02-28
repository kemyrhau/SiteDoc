import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteFlow",
  description: "Rapport- og kvalitetsstyringssystem for byggeprosjekter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
