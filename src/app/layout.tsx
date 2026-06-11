import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { TitleBar } from "@/components/TitleBar";
import { initNotifications } from "@/lib/notification";
import "./globals.css";

if (typeof window !== 'undefined') {
  initNotifications().catch(console.error);
}

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased dark`}
      >
        <TitleBar />
        {children}
      </body>
    </html>
  );
}
