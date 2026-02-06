import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realingdle - Character Guessing Game",
  description: "Guess the character from Realing RPG universe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
