"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewContactForm({ dict }: { dict: any }) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [type, setType] = useState("customer");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").insert({
      name_ar: nameAr,
      name_en: nameEn || null,
      type,
      phone: phone || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNameAr("");
    setNameEn("");
    setPhone("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-navy/10 bg-white p-5 sm:grid-cols-5 sm:items-end">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-navy/60">{dict.common.name} (AR)</label>
        <input
          required
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">{dict.common.name} (EN)</label>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">{dict.common.type}</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="customer">{dict.contactTypes.customer}</option>
          <option value="supplier">{dict.contactTypes.supplier}</option>
          <option value="both">{dict.contactTypes.both}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      {error && <p className="sm:col-span-5 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="sm:col-span-5 justify-self-start rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
      >
        {dict.common.add}
      </button>
    </form>
  );
}
