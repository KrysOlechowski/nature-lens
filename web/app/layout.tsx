import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nature Lens — przyroda Polski",
  description:
    "Nature Lens — projekt poświęcony obserwacjom gatunków i danym o przyrodzie Polski.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
