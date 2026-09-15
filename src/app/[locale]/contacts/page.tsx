import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import NewContactForm from "@/components/NewContactForm";

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  const nameField = locale === "ar" ? "name_ar" : "name_en";

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-navy">{dict.common.contacts}</h2>
      <NewContactForm dict={dict} />
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
            {contacts?.length ? (
              contacts.map((c: any) => (
                <tr key={c.id} className="border-t border-navy/5">
                  <td className="px-4 py-2.5 text-navy/70">{c.code ?? "—"}</td>
                  <td className="px-4 py-2.5 text-navy">{c[nameField]}</td>
                  <td className="px-4 py-2.5 text-navy/70">
                    {(dict.contactTypes as any)[c.type]}
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
