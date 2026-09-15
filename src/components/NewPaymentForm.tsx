"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/dictionaries";

type Contact = { id: string; name_ar: string; name_en: string | null; type: string };
type BankAccount = { id: string; code: string; name_ar: string; name_en: string | null };
type OpenInvoice = {
  id: string;
  invoice_number: string;
  contact_id: string;
  total: number;
  amount_paid: number;
};

export default function NewPaymentForm({
  dict,
  locale,
  contacts,
  bankAccounts,
  openInvoices,
}: {
  dict: any;
  locale: Locale;
  contacts: Contact[];
  bankAccounts: BankAccount[];
  openInvoices: OpenInvoice[];
}) {
  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const nameField = locale === "ar" ? "name_ar" : "name_en";

  const contactInvoices = useMemo(
    () => openInvoices.filter((inv) => inv.contact_id === contactId),
    [openInvoices, contactId]
  );

  function toggleInvoice(id: string) {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("record_payment", {
      p_contact_id: contactId,
      p_direction: direction,
      p_payment_date: paymentDate,
      p_method: "cash",
      p_amount: Number(amount),
      p_bank_account_id: bankAccountId,
      p_reference: reference || null,
      p_invoice_ids: selectedInvoices,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setReference("");
    setSelectedInvoices([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-navy/70">{dict.common.contacts}</label>
          <select
            required
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
              setSelectedInvoices([]);
            }}
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
            {locale === "ar" ? "الاتجاه" : "Direction"}
          </label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "in" | "out")}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="in">{locale === "ar" ? "قبض (من عميل)" : "In (from customer)"}</option>
            <option value="out">{locale === "ar" ? "صرف (لمورد)" : "Out (to supplier)"}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "الحساب البنكي/الصندوق" : "Bank/Cash Account"}
          </label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          >
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a[nameField as "name_ar" | "name_en"] || a.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "المبلغ" : "Amount"}
          </label>
          <input
            type="number"
            step="0.001"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
      </div>

      {contactInvoices.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-navy/70">
            {locale === "ar" ? "الفواتير المستحقة" : "Outstanding invoices"}
          </p>
          <div className="flex flex-col gap-1.5">
            {contactInvoices.map((inv) => (
              <label key={inv.id} className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={selectedInvoices.includes(inv.id)}
                  onChange={() => toggleInvoice(inv.id)}
                />
                {inv.invoice_number} — {(Number(inv.total) - Number(inv.amount_paid)).toFixed(3)} OMR
              </label>
            ))}
          </div>
        </div>
      )}

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
