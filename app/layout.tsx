import type { Metadata } from "next";
import { Epilogue, Manrope } from "next/font/google";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Datavance — Proposal & PoC Dashboard Generator",
  description: "From sales call to proposal and proof-of-concept dashboard.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${epilogue.variable} ${manrope.variable}`}>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
