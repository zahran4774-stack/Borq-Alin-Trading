import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import NewPaymentForm from "@/components/NewPaymentForm";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("*, contacts(name_ar, name_en)")
    .order("payment_date", { ascending: false });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name_ar, name_en, type")
    .order("name_ar");

  const { data: bankAccounts } = await supabase
    .from("accounts")
    .select("id, code, name_ar, name_en")
    .in("code", ["1110", "1120"]);

  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, contact_id, total, amount_paid")
    .eq("kind", "sales")
    .in("status", ["confirmed", "partially_paid"]);

  const nameField = locale === "ar" ? "name_ar" : "name_en";

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-navy">
        {locale === "ar" ? "المدفوعات" : "Payments"}
      </h2>

      <div className="mb-6 rounded-lg border border-navy/10 bg-white p-5">
        <NewPaymentForm
          dict={dict}
          locale={locale}
          contacts={contacts ?? []}
          bankAccounts={bankAccounts ?? []}
          openInvoices={openInvoices ?? []}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-4 py-3 text-start">{dict.common.contacts}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "الاتجاه" : "Direction"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "المبلغ" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {payments?.length ? (
              payments.map((p: any) => (
                <tr key={p.id} className="border-t border-navy/5">
                  <td className="px-4 py-2.5 text-navy/70">{p.payment_date}</td>
                  <td className="px-4 py-2.5 text-navy">{p.contacts?.[nameField]}</td>
                  <td className="px-4 py-2.5 text-navy/70">
                    {p.direction === "in"
                      ? locale === "ar" ? "قبض" : "In"
                      : locale === "ar" ? "صرف" : "Out"}
                  </td>
                  <td className="px-4 py-2.5 text-navy/70">{Number(p.amount).toFixed(3)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-navy/50">
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
