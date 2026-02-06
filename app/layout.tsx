import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="site">
          <header className="site__header">
            <Link href="/" className="site__logo">
              REALINGDLE
            </Link>
          </header>
          <main className="site__main">{children}</main>
          <footer className="site__footer">
            <Link href="/configs" className="site__footer-link">
              Configuracoes
            </Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
