import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dukaan Saathi — Daily Hisaab",
  description:
    "A simple daily business manager for sales, expenses, customer dues and cash closing.",
  applicationName: "Dukaan Saathi"
};

export const viewport: Viewport = {
  themeColor: "#216e4a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}