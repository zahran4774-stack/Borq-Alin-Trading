"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/dictionaries";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    const rest = pathname.replace(`/${locale}`, "") || "/dashboard";
    router.push(`/${next}${rest}`);
  }

  return (
    <button
      onClick={switchLocale}
      className="rounded border border-navy/20 px-3 py-1.5 text-sm text-navy hover:bg-navy/5 transition-colors"
    >
      {locale === "ar" ? "English" : "العربية"}
    </button>
  );
}
