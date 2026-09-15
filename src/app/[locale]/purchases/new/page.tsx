import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import NewPurchaseInvoiceForm from "@/components/NewPurchaseInvoiceForm";

export default async function NewPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name_ar, name_en, type")
    .in("type", ["supplier", "both"])
    .order("name_ar");

  const { data: products } = await supabase
    .from("products")
    .select("id, name_ar, name_en, cost_price")
    .order("name_ar");

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-navy">
        {locale === "ar" ? "فاتورة مشتريات جديدة" : "New Purchase Invoice"}
      </h2>
      <NewPurchaseInvoiceForm
        dict={dict}
        locale={locale}
        contacts={contacts ?? []}
        products={products ?? []}
      />
    </div>
  );
}
