import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/avh/theme-provider";
import { AuthProvider } from "@/components/avh/auth-provider";
import { QueryProvider } from "@/components/avh/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nội Thất AVH — Nội thất & Trang trí nhà cửa",
  description:
    "Nội Thất AVH — Cửa hàng nội thất trực tuyến: sofa, bàn ghế, giường, tủ, đèn trang trí và phụ kiện. Thiết kế hiện đại, bảo hành rõ ràng, giao hàng toàn quốc.",
  keywords: ["nội thất", "sofa", "giường", "bàn ghế", "đèn trang trí", "AVH", "trang trí nhà cửa"],
  authors: [{ name: "Nội Thất AVH" }],
  openGraph: {
    title: "Nội Thất AVH",
    description: "Nội thất hiện đại, trang trọng — mua trực tiếp từ AVH",
    siteName: "Nội Thất AVH",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              {children}
              <Toaster />
              <SonnerToaster position="top-center" richColors />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
