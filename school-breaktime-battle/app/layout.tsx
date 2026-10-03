import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Breaktime Battle",
  description:
    "A multiplayer school-themed browser game. Race to the canteen, collect snacks, avoid prefects, and return to class before the bell rings.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-school min-h-dvh antialiased">{children}</body>
    </html>
  );
}
