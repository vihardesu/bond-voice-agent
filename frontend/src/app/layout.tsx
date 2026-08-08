import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { RouteProvider } from "@/providers/route-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Bond Voice Agent",
  description: "Bond Voice Agent",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} scroll-smooth`}>
      <body className="bg-primary font-body antialiased">
        <RouteProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </RouteProvider>
      </body>
    </html>
  );
}
