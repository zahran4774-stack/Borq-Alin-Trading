import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, contacts(name_ar, name_en)")
    .eq("kind", "sales")
    .order("invoice_date", { ascending: false });

  const nameField = locale === "ar" ? "name_ar" : "name_en";
  const statusLabels: Record<string, { ar: string; en: string }> = {
    draft: { ar: "مسودة", en: "Draft" },
    confirmed: { ar: "مؤكدة", en: "Confirmed" },
    partially_paid: { ar: "مدفوعة جزئياً", en: "Partially Paid" },
    paid: { ar: "مدفوعة", en: "Paid" },
    cancelled: { ar: "ملغاة", en: "Cancelled" },
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-navy">{dict.common.invoices}</h2>
        <Link
          href={`/${locale}/invoices/new`}
          className="rounded bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold-dark transition-colors"
        >
          {dict.common.add}
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
              <th className="px-4 py-3 text-start">{dict.common.contacts}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "الإجمالي" : "Total"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.length ? (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="border-t border-navy/5">
                  <td className="px-4 py-2.5">
                    <Link href={`/${locale}/invoices/${inv.id}`} className="text-navy underline decoration-gold underline-offset-4">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-navy/70">{inv.contacts?.[nameField]}</td>
                  <td className="px-4 py-2.5 text-navy/70">{inv.invoice_date}</td>
                  <td className="px-4 py-2.5 text-navy/70">{Number(inv.total).toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-navy/70">
                    {statusLabels[inv.status]?.[locale] ?? inv.status}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                  {dict.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
