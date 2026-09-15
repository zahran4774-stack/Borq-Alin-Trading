import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("code");

  const nameField = locale === "ar" ? "name_ar" : "name_en";

  return (
    <div>
      <h2 className="text-xl font-semibold text-navy mb-6">{dict.common.accounts}</h2>
      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 text-start">{dict.common.code}</th>
              <th className="px-4 py-3 text-start">{dict.common.name}</th>
              <th className="px-4 py-3 text-start">{dict.common.type}</th>
            </tr>
          </thead>
          <tbody>
            {accounts?.length ? (
              accounts.map((acc: any) => (
                <tr key={acc.id} className="border-t border-navy/5">
                  <td className="px-4 py-2.5 text-navy/70">{acc.code}</td>
                  <td
                    className={`px-4 py-2.5 ${acc.is_group ? "font-semibold text-navy" : ""}`}
                    style={{ paddingInlineStart: acc.is_group ? "1rem" : "2rem" }}
                  >
                    {acc.is_group ? (
                      acc[nameField]
                    ) : (
                      <Link
                        href={`/${locale}/accounts/${acc.id}`}
                        className="text-navy underline decoration-gold underline-offset-4"
                      >
                        {acc[nameField]}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-navy/70">
                    {(dict.accountTypes as any)[acc.type]}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-navy/50">
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
