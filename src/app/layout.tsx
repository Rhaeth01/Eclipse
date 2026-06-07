import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TitleBar } from "@/components/TitleBar";
import { initNotifications } from "@/lib/notification";
import "./globals.css";

// Initialise les notifications au démarrage (côté client uniquement)
if (typeof window !== 'undefined') {
  initNotifications().catch(console.error);
}

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eclipse - Discord Toolkit",
  description: "Advanced Discord toolkit for power users",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased selection:bg-indigo-500/30 dark`}
      >
        <TitleBar />
        {children}
      </body>
    </html>
  );
}
