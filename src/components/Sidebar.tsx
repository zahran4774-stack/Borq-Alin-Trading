import Link from "next/link";
import type { Locale } from "@/i18n/dictionaries";

export default function Sidebar({
  locale,
  dict,
}: {
  locale: Locale;
  dict: any;
}) {
  const items = [
    { href: `/${locale}/dashboard`, label: dict.common.dashboard },
    { href: `/${locale}/invoices`, label: locale === "ar" ? "فواتير المبيعات" : "Sales Invoices" },
    { href: `/${locale}/purchases`, label: locale === "ar" ? "فواتير المشتريات" : "Purchase Invoices" },
    { href: `/${locale}/payments`, label: locale === "ar" ? "المدفوعات" : "Payments" },
    { href: `/${locale}/inventory`, label: dict.common.inventory },
    { href: `/${locale}/accounts`, label: dict.common.accounts },
    { href: `/${locale}/contacts`, label: dict.common.contacts },
    { href: `/${locale}/reports`, label: dict.common.reports },
    { href: `/${locale}/settings`, label: locale === "ar" ? "الإعدادات" : "Settings" },
  ];

  return (
    <aside className="w-64 shrink-0 bg-navy text-white">
      <div className="px-6 py-5 border-b border-white/10">
        <span className="text-gold font-semibold text-lg">{dict.common.appName}</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-3 py-2 text-sm hover:bg-white/10 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
