import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

const statusLabels: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  confirmed: { ar: "مؤكدة", en: "Confirmed" },
  partially_paid: { ar: "مدفوعة جزئياً", en: "Partially Paid" },
  paid: { ar: "مدفوعة", en: "Paid" },
  cancelled: { ar: "ملغاة", en: "Cancelled" },
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ar" ? "name_ar" : "name_en";

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, contacts(name_ar, name_en, phone, email)")
    .eq("id", id)
    .single();

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", id);

  const { data: journalLines } = invoice?.journal_entry_id
    ? await supabase
        .from("journal_lines")
        .select("*, accounts(code, name_ar, name_en)")
        .eq("journal_entry_id", invoice.journal_entry_id)
    : { data: [] };

  if (!invoice) {
    return <p className="text-navy/60">{dict.common.noData}</p>;
  }

  const backHref = invoice.kind === "sales" ? `/${locale}/invoices` : `/${locale}/purchases`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={backHref} className="text-sm text-navy underline decoration-gold underline-offset-4">
          {locale === "ar" ? "→ رجوع للقائمة" : "← Back to list"}
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy">{invoice.invoice_number}</h2>
          <p className="mt-1 text-sm text-navy/60">
            {invoice.contacts?.[nameField]} · {invoice.invoice_date}
          </p>
        </div>
        <span className="rounded-full bg-navy/5 px-3 py-1 text-sm text-navy">
          {statusLabels[invoice.status]?.[locale] ?? invoice.status}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "الوصف" : "Description"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "الكمية" : "Qty"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "السعر" : "Price"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "الإجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((l: any) => (
              <tr key={l.id} className="border-t border-navy/5">
                <td className="px-4 py-2 text-navy">
                  {locale === "ar" ? l.description_ar : l.description_en || l.description_ar}
                </td>
                <td className="px-4 py-2 text-navy/70">{l.quantity}</td>
                <td className="px-4 py-2 text-navy/70">{Number(l.unit_price).toFixed(3)}</td>
                <td className="px-4 py-2 text-navy/70">{Number(l.line_total).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col items-end gap-1 border-t border-navy/10 px-4 py-3 text-sm">
          <p className="flex w-48 justify-between text-navy/70">
            <span>{locale === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
            <span>{Number(invoice.subtotal).toFixed(3)}</span>
          </p>
          <p className="flex w-48 justify-between text-navy/70">
            <span>{locale === "ar" ? "الضريبة" : "Tax"}</span>
            <span>{Number(invoice.tax_amount).toFixed(3)}</span>
          </p>
          <p className="flex w-48 justify-between font-semibold text-navy">
            <span>{locale === "ar" ? "الإجمالي" : "Total"}</span>
            <span>{Number(invoice.total).toFixed(3)}</span>
          </p>
          <p className="flex w-48 justify-between text-navy/70">
            <span>{locale === "ar" ? "المدفوع" : "Paid"}</span>
            <span>{Number(invoice.amount_paid).toFixed(3)}</span>
          </p>
          <p className="flex w-48 justify-between font-semibold text-navy">
            <span>{locale === "ar" ? "المتبقي" : "Balance"}</span>
            <span>{(Number(invoice.total) - Number(invoice.amount_paid)).toFixed(3)}</span>
          </p>
        </div>
      </div>

      {journalLines && journalLines.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-navy">
            {locale === "ar" ? "القيد المحاسبي" : "Journal Entry"}
          </h3>
          <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-2 text-start">{dict.common.code}</th>
                  <th className="px-4 py-2 text-start">{dict.common.name}</th>
                  <th className="px-4 py-2 text-start">{locale === "ar" ? "مدين" : "Debit"}</th>
                  <th className="px-4 py-2 text-start">{locale === "ar" ? "دائن" : "Credit"}</th>
                </tr>
              </thead>
              <tbody>
                {journalLines.map((jl: any) => (
                  <tr key={jl.id} className="border-t border-navy/5">
                    <td className="px-4 py-2 text-navy/70">{jl.accounts?.code}</td>
                    <td className="px-4 py-2 text-navy">{jl.accounts?.[nameField]}</td>
                    <td className="px-4 py-2 text-navy/70">
                      {Number(jl.debit) > 0 ? Number(jl.debit).toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-2 text-navy/70">
                      {Number(jl.credit) > 0 ? Number(jl.credit).toFixed(3) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
