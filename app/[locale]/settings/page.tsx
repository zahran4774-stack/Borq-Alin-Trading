import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import CompanySettingsForm from "@/components/CompanySettingsForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .single();

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-navy">
        {locale === "ar" ? "إعدادات الشركة" : "Company Settings"}
      </h2>
      <CompanySettingsForm dict={dict} locale={locale} settings={settings} />
    </div>
  );
}
