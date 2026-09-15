"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewProductForm({ dict }: { dict: any }) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [qty, setQty] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("products").insert({
      name_ar: nameAr,
      name_en: nameEn || null,
      sale_price: Number(salePrice) || 0,
      cost_price: Number(costPrice) || 0,
      quantity_on_hand: Number(qty) || 0,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNameAr("");
    setNameEn("");
    setSalePrice("");
    setCostPrice("");
    setQty("0");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-navy/60">{dict.common.name} (AR)</label>
        <input
          required
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-navy/60">{dict.common.name} (EN)</label>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">Qty</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">Cost</label>
        <input
          type="number"
          step="0.001"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-navy/60">Sale Price</label>
        <input
          type="number"
          step="0.001"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
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
