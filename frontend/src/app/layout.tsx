import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Qarz Daftar",
  description: "Qarzlaringizni qog'ozsiz, tartibli yuriting",
};

export const viewport: Viewport = {
  themeColor: "#0B6B3E",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
