"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/dictionaries";

type Contact = { id: string; name_ar: string; name_en: string | null; type: string };
type Product = { id: string; name_ar: string; name_en: string | null; cost_price: number };

type Line = {
  product_id: string;
  description_ar: string;
  description_en: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const emptyLine = (): Line => ({
  product_id: "",
  description_ar: "",
  description_en: "",
  quantity: "1",
  unit_price: "0",
  tax_rate: "0",
});

export default function NewPurchaseInvoiceForm({
  dict,
  locale,
  contacts,
  products,
}: {
  dict: any;
  locale: Locale;
  contacts: Contact[];
  products: Product[];
}) {
  const [contactId, setContactId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const nameField = locale === "ar" ? "name_ar" : "name_en";

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function onProductPick(i: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(i, {
      product_id: productId,
      unit_price: product ? String(product.cost_price) : "0",
      description_ar: product?.name_ar ?? "",
      description_en: product?.name_en ?? "",
    });
  }

  const total = lines.reduce((sum, l) => {
    const lineTotal = Number(l.quantity || 0) * Number(l.unit_price || 0);
    return sum + lineTotal * (1 + Number(l.tax_rate || 0) / 100);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_purchase_invoice", {
      p_contact_id: contactId,
      p_invoice_number: invoiceNumber,
      p_invoice_date: invoiceDate,
      p_due_date: dueDate || null,
      p_lines: lines.map((l) => ({
        product_id: l.product_id || null,
        description_ar: l.description_ar,
        description_en: l.description_en,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate),
      })),
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/${locale}/purchases`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "المورد" : "Supplier"}
          </label>
          <select
            required
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="" disabled>
              —
            </option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c[nameField] || c.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "رقم الفاتورة" : "Invoice #"}
          </label>
          <input
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "التاريخ" : "Date"}
          </label>
          <input
            type="date"
            required
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
      </div>

      <div className="rounded-lg border border-navy/10">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-3 py-2 text-start">{locale === "ar" ? "المنتج" : "Product"}</th>
              <th className="px-3 py-2 text-start">{locale === "ar" ? "الكمية" : "Qty"}</th>
              <th className="px-3 py-2 text-start">{locale === "ar" ? "سعر التكلفة" : "Cost"}</th>
              <th className="px-3 py-2 text-start">{locale === "ar" ? "ضريبة %" : "Tax %"}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-navy/5">
                <td className="px-3 py-2">
                  <select
                    value={line.product_id}
                    onChange={(e) => onProductPick(i, e.target.value)}
                    className="w-full rounded border border-navy/20 px-2 py-1.5 text-sm outline-none focus:border-gold"
                  >
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p[nameField] || p.name_ar}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    className="w-24 rounded border border-navy/20 px-2 py-1.5 text-sm outline-none focus:border-gold"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                    className="w-28 rounded border border-navy/20 px-2 py-1.5 text-sm outline-none focus:border-gold"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={line.tax_rate}
                    onChange={(e) => updateLine(i, { tax_rate: e.target.value })}
                    className="w-20 rounded border border-navy/20 px-2 py-1.5 text-sm outline-none focus:border-gold"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        className="self-start text-sm text-navy underline decoration-gold underline-offset-4"
      >
        {locale === "ar" ? "+ إضافة سطر" : "+ Add line"}
      </button>

      <div className="text-end text-navy font-semibold">
        {locale === "ar" ? "الإجمالي" : "Total"}: {total.toFixed(3)} OMR
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
      >
        {dict.common.save}
      </button>
    </form>
  );
}
