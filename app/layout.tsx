import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Sun Textile CRM",
  description: "Учет каталога, заказов, магазинов и складских остатков Sun Textile",
  icons: {
    icon: "/sun-textile-logo.jpeg",
    apple: "/sun-textile-logo.jpeg",
  },
  openGraph: {
    title: "Sun Textile CRM",
    description: "Учет каталога, заказов, магазинов и складских остатков Sun Textile",
    locale: "ru_KG",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sun Textile CRM",
    description: "Учет каталога, заказов, магазинов и складских остатков Sun Textile",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1b2941",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
