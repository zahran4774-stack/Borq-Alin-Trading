import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ar" ? "name_ar" : "name_en";

  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("*, journal_entries(entry_date, reference, memo_ar, memo_en)")
    .eq("account_id", id)
    .order("id");

  if (!account) {
    return <p className="text-navy/60">{dict.common.noData}</p>;
  }

  let running = 0;
  const rows = (lines ?? [])
    .map((l: any) => {
      running += Number(l.debit) - Number(l.credit);
      return { ...l, running };
    })
    .sort(
      (a: any, b: any) =>
        new Date(a.journal_entries?.entry_date).getTime() -
        new Date(b.journal_entries?.entry_date).getTime()
    );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${locale}/accounts`}
        className="text-sm text-navy underline decoration-gold underline-offset-4"
      >
        {locale === "ar" ? "→ رجوع لدليل الحسابات" : "← Back to chart of accounts"}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-navy">
          {account.code} — {account[nameField]}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {(dict.accountTypes as any)[account.type]}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "المرجع" : "Reference"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "مدين" : "Debit"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "دائن" : "Credit"}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "الرصيد" : "Balance"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((l: any) => (
                <tr key={l.id} className="border-t border-navy/5">
                  <td className="px-4 py-2 text-navy/70">{l.journal_entries?.entry_date}</td>
                  <td className="px-4 py-2 text-navy">
                    {l.journal_entries?.reference ||
                      (locale === "ar" ? l.journal_entries?.memo_ar : l.journal_entries?.memo_en)}
                  </td>
                  <td className="px-4 py-2 text-navy/70">
                    {Number(l.debit) > 0 ? Number(l.debit).toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-2 text-navy/70">
                    {Number(l.credit) > 0 ? Number(l.credit).toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-2 text-navy">{l.running.toFixed(3)}</td>
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
