import type { Metadata } from "next";
import "../globals.css";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import Sidebar from "@/components/Sidebar";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "ليروق العين للتجارة | Al-Ain Trading",
  description: "نظام محاسبة ثنائي اللغة لشركة ليروق العين للتجارة",
};

export function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-cairo antialiased">
        <div className="flex min-h-screen">
          <Sidebar locale={locale} dict={dict} />
          <div className="flex-1 flex flex-col">
            <header className="flex items-center justify-between border-b border-navy/10 bg-white px-6 py-4">
              <h1 className="text-lg font-semibold text-navy">{dict.common.appName}</h1>
              <LanguageSwitcher locale={locale} />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
