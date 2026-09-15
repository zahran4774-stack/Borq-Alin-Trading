import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

function fmt(n: number, locale: Locale) {
  return Number(n).toLocaleString(locale === "ar" ? "ar-OM" : "en-US", {
    minimumFractionDigits: 3,
  });
}

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ar" ? "name_ar" : "name_en";

  const [{ data: trialBalance }, { data: incomeStatement }, { data: balanceSheet }, { data: arAging }] =
    await Promise.all([
      supabase.from("trial_balance").select("*"),
      supabase.from("income_statement").select("*"),
      supabase.from("balance_sheet").select("*"),
      supabase.from("ar_aging").select("*").order("due_date"),
    ]);

  const revenue =
    incomeStatement?.filter((r: any) => r.type === "revenue") ?? [];
  const expenses =
    incomeStatement?.filter((r: any) => r.type === "expense") ?? [];
  const totalRevenue = revenue.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netIncome = totalRevenue - totalExpenses;

  const assets = balanceSheet?.filter((r: any) => r.type === "asset") ?? [];
  const liabilities = balanceSheet?.filter((r: any) => r.type === "liability") ?? [];
  const equity = balanceSheet?.filter((r: any) => r.type === "equity") ?? [];

  return (
    <div className="flex flex-col gap-10">
      <h2 className="text-xl font-semibold text-navy">{dict.common.reports}</h2>

      <section>
        <h3 className="mb-3 font-semibold text-navy">
          {locale === "ar" ? "ميزان المراجعة" : "Trial Balance"}
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
              {trialBalance?.length ? (
                trialBalance.map((r: any) => (
                  <tr key={r.account_id} className="border-t border-navy/5">
                    <td className="px-4 py-2 text-navy/70">{r.code}</td>
                    <td className="px-4 py-2 text-navy">{r[nameField]}</td>
                    <td className="px-4 py-2 text-navy/70">{fmt(r.total_debit, locale)}</td>
                    <td className="px-4 py-2 text-navy/70">{fmt(r.total_credit, locale)}</td>
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
      </section>

      <section>
        <h3 className="mb-3 font-semibold text-navy">
          {locale === "ar" ? "قائمة الدخل" : "Income Statement"}
        </h3>
        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white p-4 text-sm">
          <p className="mb-1 flex justify-between text-navy">
            <span>{locale === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}</span>
            <span>{fmt(totalRevenue, locale)}</span>
          </p>
          <p className="mb-1 flex justify-between text-navy">
            <span>{locale === "ar" ? "إجمالي المصروفات" : "Total Expenses"}</span>
            <span>{fmt(totalExpenses, locale)}</span>
          </p>
          <p className="mt-2 flex justify-between border-t border-navy/10 pt-2 font-semibold text-navy">
            <span>{locale === "ar" ? "صافي الدخل" : "Net Income"}</span>
            <span>{fmt(netIncome, locale)}</span>
          </p>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold text-navy">
          {locale === "ar" ? "الميزانية العمومية" : "Balance Sheet"}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { title: dict.accountTypes.asset, rows: assets },
            { title: dict.accountTypes.liability, rows: liabilities },
            { title: dict.accountTypes.equity, rows: equity },
          ].map((group) => (
            <div key={group.title} className="rounded-lg border border-navy/10 bg-white p-4 text-sm">
              <p className="mb-2 font-semibold text-navy">{group.title}</p>
              {group.rows.length ? (
                group.rows.map((r: any) => (
                  <p key={r.code} className="flex justify-between text-navy/70">
                    <span>{r[nameField]}</span>
                    <span>{fmt(r.amount, locale)}</span>
                  </p>
                ))
              ) : (
                <p className="text-navy/40">{dict.common.noData}</p>
              )}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-semibold text-navy">
          {locale === "ar" ? "أعمار الذمم المدينة" : "AR Aging"}
        </h3>
        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="px-4 py-2 text-start">{dict.common.contacts}</th>
                <th className="px-4 py-2 text-start">{locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
                <th className="px-4 py-2 text-start">{locale === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</th>
                <th className="px-4 py-2 text-start">{locale === "ar" ? "المتبقي" : "Outstanding"}</th>
                <th className="px-4 py-2 text-start">{locale === "ar" ? "الفئة" : "Bucket"}</th>
              </tr>
            </thead>
            <tbody>
              {arAging?.length ? (
                arAging.map((r: any) => (
                  <tr key={r.invoice_id} className="border-t border-navy/5">
                    <td className="px-4 py-2 text-navy">{r[nameField]}</td>
                    <td className="px-4 py-2 text-navy/70">{r.invoice_number}</td>
                    <td className="px-4 py-2 text-navy/70">{r.due_date ?? "—"}</td>
                    <td className="px-4 py-2 text-navy/70">{fmt(r.outstanding, locale)}</td>
                    <td className="px-4 py-2 text-navy/70">{r.bucket}</td>
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
      </section>
    </div>
  );
}
