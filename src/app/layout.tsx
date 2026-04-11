import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TestAS Mock Test",
  description: "Digital mock exam that simulates the real TestAS experience. Practice Figure Sequences, Mathematical Equations, Latin Squares, and Module Tests.",
  keywords: ["TestAS", "mock test", "exam practice", "figure sequences", "mathematical equations", "latin squares"],
  icons: {
    icon: '/logo.avif',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
