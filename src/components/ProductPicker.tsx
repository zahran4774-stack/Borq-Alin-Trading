"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg } from "@/lib/format";
import type { Product } from "@/lib/types";

// اختيار منتج بالكتابة (بحث بالاسم / الباركود / SKU / الماركة) مع إمكانية إضافة منتج جديد مباشرة
export default function ProductPicker({ products, value, onPick, onCreated }: {
  products: Product[]; value: string; onPick: (p: Product) => void; onCreated: (p: Product) => void;
}) {
  const { sb, company, can } = useApp();
  const canCreate = can("admin", "accountant", "branch_manager");
  const cur = products.find((p) => p.id === value);
  const [q, setQ] = useState(cur?.name_ar || "");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(cur?.name_ar || ""); }, [cur?.id]); // eslint-disable-line
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(cur?.name_ar || ""); } };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [cur?.name_ar]);

  const t = q.trim().toLowerCase();
  const list = useMemo(() => {
    if (!t || t === cur?.name_ar?.toLowerCase()) return products.slice(0, 50);
    return products.filter((p) => [p.name_ar, p.name_en, p.sku, p.barcode, p.brand, p.model].some((x) => x?.toLowerCase().includes(t))).slice(0, 50);
  }, [products, t, cur?.name_ar]);

  async function create(serial: boolean) {
    const name = q.trim(); if (!name) return;
    setBusy(true); setErr("");
    const { data, error } = await sb.from("products").insert({
      name_ar: name, tax_rate: Number(company.default_vat_rate), sale_price: 0, unit_ar: "قطعة",
      is_service: false, track_serial: serial, is_active: true, warranty_months: 0, reorder_level: 0,
    }).select("*").single();
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    onCreated(data as any); onPick(data as any); setOpen(false);
  }

  return (
    <div className="relative" ref={box}>
      <input className="input" placeholder="اكتب اسم المنتج أو الباركود…" value={q}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] max-h-64 overflow-auto bg-white border rounded shadow-lg text-sm">
          {list.map((p) => (
            <button type="button" key={p.id} className="block w-full text-right px-3 py-2 hover:bg-slate-100 border-b last:border-0"
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(p); setQ(p.name_ar); setOpen(false); }}>
              {p.name_ar}{p.sku && <span className="text-xs text-slate-500 num"> · {p.sku}</span>}
            </button>
          ))}
          {!list.length && <div className="px-3 py-2 text-slate-500">{products.length ? "لا توجد نتائج" : "لا توجد منتجات بعد"}</div>}
          {canCreate && q.trim() && !products.some((p) => p.name_ar.trim().toLowerCase() === t) && (
            <div className="p-2 bg-slate-50 border-t space-y-1">
              <div className="text-xs text-slate-500">إضافة «{q.trim()}» كمنتج جديد:</div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-sec btn-sm" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => create(false)}>منتج عادي</button>
                <button type="button" className="btn btn-sec btn-sm" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => create(true)}>بأرقام تسلسلية (IMEI)</button>
              </div>
              {err && <div className="text-xs text-red-600">{err}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
