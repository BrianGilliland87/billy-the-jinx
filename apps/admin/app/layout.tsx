import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billy the Jinx Admin",
  description: "Billy the Jinx tournament administration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <nav style={{
          backgroundColor: "#4b1d6b",
          padding: "12px 32px",
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}>
          <span style={{ color: "#d4af37", fontWeight: 800, fontSize: 18, marginRight: 16 }}>
            🪄 Billy Admin
          </span>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Events
          </Link>
          <Link href="/bracket" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Bracket
          </Link>
          <Link href="/tournament" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Tournament
          </Link>
          <Link href="/teams" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Teams
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
