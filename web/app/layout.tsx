import type { Metadata } from "next";
import type { ReactNode } from "react";
import { productionSiteUrl } from "../env";
import "./globals.css";

export const metadata: Metadata = {
  ...(productionSiteUrl ? { metadataBase: productionSiteUrl } : {}),
  applicationName: "Nature Lens",
  title: {
    default: "Nature Lens — Nature in Poland",
    template: "%s | Nature Lens",
  },
  description:
    "Nature Lens — a project exploring species observations and nature data across Poland.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
