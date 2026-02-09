import type { Metadata } from "next"
import Link from "next/link"
import HeaderMenu from "@/components/HeaderMenu"
import ScrollPage from "@/components/ScrollPage"
import "./globals.sass"

export const metadata: Metadata = {
  title: "Realingdle - Character Guessing Game",
  description: "Guess the character from the clues!",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ScrollPage>
          <div className="site">
            <header className="site__header">
              <Link href="/" className="site__logo">
                REALINGDLE
              </Link>
              <HeaderMenu />
            </header>
            <main className="site__main">{children}</main>
            <footer className="site__footer" />
          </div>
        </ScrollPage>
      </body>
    </html>
  )
}
