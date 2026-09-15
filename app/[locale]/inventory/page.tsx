import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";
import NewProductForm from "@/components/NewProductForm";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const nameField = locale === "ar" ? "name_ar" : "name_en";
  const unitField = locale === "ar" ? "unit_ar" : "unit_en";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-navy">{dict.common.inventory}</h2>
      </div>

      <div className="mb-6 rounded-lg border border-navy/10 bg-white p-5">
        <NewProductForm dict={dict} />
      </div>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 text-start">{dict.common.name}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "الوحدة" : "Unit"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "الكمية" : "Qty"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "سعر البيع" : "Sale Price"}</th>
            </tr>
          </thead>
          <tbody>
            {products?.length ? (
              products.map((p: any) => (
                <tr key={p.id} className="border-t border-navy/5">
                  <td className="px-4 py-2.5 text-navy">{p[nameField]}</td>
                  <td className="px-4 py-2.5 text-navy/70">{p[unitField]}</td>
                  <td className="px-4 py-2.5 text-navy/70">{p.quantity_on_hand}</td>
                  <td className="px-4 py-2.5 text-navy/70">{p.sale_price}</td>
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
