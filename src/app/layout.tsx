import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import PwaBoot from "@/components/PwaBoot";

export const metadata: Metadata = {
  title: "بروق العين للتجارة — نظام المحاسبة",
  description: "نظام محاسبة ومبيعات وصيانة متعدد الفروع",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "بروق العين", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0f2647" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("lang")==="en"){var d=document.documentElement;d.lang="en";d.dir="ltr";d.dataset.lang="en"}}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><LangProvider>{children}<PwaBoot /></LangProvider></body>
    </html>
  );
}
