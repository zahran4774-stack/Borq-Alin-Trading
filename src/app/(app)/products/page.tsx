"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, money, fdate } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Empty, Field, Modal, Msg, PageHeader, usePaged } from "@/components/ui";

const blank = { name_ar: "", name_en: "", sku: "", barcode: "", brand: "", model: "", category_id: "", sale_price: 0, tax_rate: 5, is_service: false, track_serial: false, warranty_months: 0, reorder_level: 0, unit_ar: "قطعة", is_active: true };

export default function Products() {
  const { sb, can, branches, branchId, company } = useApp();
  const { lang } = useLang();
  const canEdit = can("admin", "accountant", "branch_manager");
  const showCost = can("admin", "accountant", "branch_manager", "viewer");
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<string, Record<string, number>>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [serialsFor, setSerialsFor] = useState<Product | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    const [p, c, s] = await Promise.all([
      sb.from("products").select("*").order("name_ar").limit(5000),
      sb.from("product_categories").select("*").order("sort_order"),
      sb.from("branch_stock").select("branch_id,product_id,quantity").limit(20000),
    ]);
    setRows((p.data as any) || []); setCats((c.data as any) || []);
    const m: any = {};
    ((s.data as any[]) || []).forEach((r) => { (m[r.product_id] ||= {})[r.branch_id] = Number(r.quantity); });
    setStock(m);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((p) => (!cat || p.category_id === cat) && (!t || [p.name_ar, p.sku, p.barcode, p.brand, p.model].some((x) => x?.toLowerCase().includes(t))));
  }, [rows, q, cat]);
  const pg = usePaged(list, 50);

  async function save() {
    setErr("");
    const e = edit;
    if (!e.name_ar?.trim()) { setErr("اسم المنتج مطلوب"); return; }
    const payload: any = {
      name_ar: e.name_ar.trim(), name_en: e.name_en?.trim() || null, sku: e.sku || null, barcode: e.barcode || null, brand: e.brand || null, model: e.model || null,
      category_id: e.category_id || null, sale_price: Number(e.sale_price), tax_rate: Number(e.tax_rate),
      is_service: !!e.is_service, track_serial: !!e.track_serial && !e.is_service, warranty_months: Number(e.warranty_months) || 0,
      reorder_level: Number(e.reorder_level) || 0, unit_ar: e.unit_ar || "قطعة", is_active: !!e.is_active,
    };
    const r = e.id ? await sb.from("products").update(payload).eq("id", e.id) : await sb.from("products").insert(payload);
    if (r.error) { setErr(errMsg(r.error)); return; }
    setEdit(null); setOk("تم الحفظ"); load();
  }

  const stockOf = (p: Product) => branchId === "all" ? Object.values(stock[p.id] || {}).reduce((a, b) => a + b, 0) : stock[p.id]?.[branchId] || 0;

  return (
    <div>
      <PageHeader title="المنتجات والخدمات">
        {canEdit && <button className="btn" onClick={() => { setErr(""); setEdit({ ...blank, tax_rate: company.default_vat_rate }); }}><I n="plus" /> منتج جديد</button>}
      </PageHeader>
      <Msg ok={ok} error={!edit ? err : ""} />
      <div className="card mb-3 flex flex-wrap gap-3">
        <input className="input !w-64" placeholder="بحث: اسم / باركود / SKU / ماركة" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">كل التصنيفات</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>المنتج</th><th>التصنيف</th><th>الباركود</th><th>سعر البيع</th>{showCost && <th>متوسط التكلفة</th>}<th>المخزون</th><th></th></tr></thead>
          <tbody>
            {pg.rows.map((p) => {
              const st = stockOf(p);
              return (
                <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                  <td><div className="font-medium">{lang === "en" && p.name_en ? p.name_en : p.name_ar}</div><div className="text-xs text-slate-500">{[p.brand, p.model, p.sku].filter(Boolean).join(" · ")}{p.track_serial ? " · IMEI" : ""}{p.is_service ? " · خدمة" : ""}</div></td>
                  <td>{cats.find((c) => c.id === p.category_id)?.name_ar}</td>
                  <td className="num">{p.barcode}</td>
                  <td className="num">{money(p.sale_price)}</td>
                  {showCost && <td className="num">{money(p.cost_price)}</td>}
                  <td>{p.is_service ? "—" : <span className={`num ${st <= Number(p.reorder_level) ? "text-red-600 font-bold" : ""}`}>{st}</span>}
                    {!p.is_service && branchId === "all" && branches.length > 1 && <span className="text-xs text-slate-400 mr-1">({branches.map((b) => stock[p.id]?.[b.id] || 0).join(" / ")})</span>}</td>
                  <td className="space-x-2 space-x-reverse whitespace-nowrap">
                    {canEdit && <button className="text-brand-600 underline" onClick={() => { setErr(""); setEdit({ ...p, category_id: p.category_id || "" }); }}>تعديل</button>}
                    {p.track_serial && <button className="text-brand-600 underline" onClick={() => setSerialsFor(p)}>الأرقام التسلسلية</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>{pg.bar}
        {!list.length && <Empty />}
      </div>

      {edit && (
        <Modal title={edit.id ? "تعديل منتج" : "منتج جديد"} onClose={() => setEdit(null)} wide>
          <Msg error={err} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="الاسم *" className="sm:col-span-2"><input className="input" value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
            <Field label="الاسم بالإنجليزية (يظهر في الفاتورة بالإنجليزية)" className="sm:col-span-2"><input className="input" dir="ltr" value={edit.name_en || ""} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></Field>
            <Field label="التصنيف"><select className="input" value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select></Field>
            <Field label="الباركود"><input className="input num" value={edit.barcode || ""} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} /></Field>
            <Field label="الماركة"><input className="input" value={edit.brand || ""} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} /></Field>
            <Field label="الموديل"><input className="input" value={edit.model || ""} onChange={(e) => setEdit({ ...edit, model: e.target.value })} /></Field>
            <Field label="SKU"><input className="input num" value={edit.sku || ""} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} /></Field>
            <Field label="الوحدة"><input className="input" value={edit.unit_ar || ""} onChange={(e) => setEdit({ ...edit, unit_ar: e.target.value })} /></Field>
            <Field label="سعر البيع (قبل الضريبة)"><input type="number" step="0.001" className="input num" value={edit.sale_price} onChange={(e) => setEdit({ ...edit, sale_price: e.target.value })} /></Field>
            <Field label="نسبة الضريبة %"><input type="number" step="0.01" className="input num" value={edit.tax_rate} onChange={(e) => setEdit({ ...edit, tax_rate: e.target.value })} /></Field>
            <Field label="مدة الضمان (أشهر)"><input type="number" className="input num" value={edit.warranty_months} onChange={(e) => setEdit({ ...edit, warranty_months: e.target.value })} /></Field>
            <Field label="حد إعادة الطلب"><input type="number" className="input num" value={edit.reorder_level} onChange={(e) => setEdit({ ...edit, reorder_level: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_service} onChange={(e) => setEdit({ ...edit, is_service: e.target.checked })} /> خدمة (بدون مخزون)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.track_serial} disabled={edit.is_service} onChange={(e) => setEdit({ ...edit, track_serial: e.target.checked })} /> تتبع IMEI / رقم تسلسلي</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> فعّال</label>
          </div>
          <p className="text-xs text-slate-500 mt-3">متوسط التكلفة يُحسب تلقائياً من فواتير الشراء والرصيد الافتتاحي ولا يُعدّل يدوياً حفاظاً على دقة المحاسبة.</p>
          <button className="btn w-full mt-3" onClick={save}><I n="save" /> حفظ</button>
        </Modal>
      )}
      {serialsFor && <SerialsModal p={serialsFor} onClose={() => setSerialsFor(null)} />}
    </div>
  );
}

function SerialsModal({ p, onClose }: { p: Product; onClose: () => void }) {
  const { sb, branches } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const pgS = usePaged(rows.filter((r) => !q || r.serial_no.includes(q)), 50);
  useEffect(() => { sb.from("product_serials").select("*, invoices:sale_invoice_id(invoice_number)").eq("product_id", p.id).order("created_at", { ascending: false }).limit(1000).then(({ data }) => setRows((data as any) || [])); }, [sb, p.id]);
  const ST: any = { in_stock: "بالمخزون", sold: "مباع", returned_supplier: "مرتجع للمورد", lost: "مفقود" };
  return (
    <Modal title={`الأرقام التسلسلية — ${p.name_ar}`} onClose={onClose} wide>
      <input className="input mb-3" placeholder="بحث برقم IMEI" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-96 overflow-auto">
        <table className="tbl"><thead><tr><th>الرقم</th><th>الحالة</th><th>الفرع</th><th>فاتورة البيع</th><th>نهاية الضمان</th></tr></thead>
          <tbody>{pgS.rows.map((r) => (
            <tr key={r.id}><td className="num">{r.serial_no}</td><td>{ST[r.status]}</td><td>{branches.find((b) => b.id === r.branch_id)?.name_ar}</td><td className="num">{r.invoices?.invoice_number}</td><td>{fdate(r.warranty_end)}</td></tr>
          ))}</tbody></table>{pgS.bar}
        {!rows.length && <Empty />}
      </div>
    </Modal>
  );
}
