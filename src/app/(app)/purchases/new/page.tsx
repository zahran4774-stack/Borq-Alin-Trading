"use client";
import { I } from "@/components/Icon";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { errMsg, METHODS, money, r3, today } from "@/lib/format";
import type { Contact, Product } from "@/lib/types";
import { Msg, NeedBranch, PageHeader } from "@/components/ui";

type L = { key: string; product_id: string; qty: number; cost: number; rate: number; serialsText: string };

export default function NewPurchase() {
  const { sb, opBranch, company } = useApp();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState(today());
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<L[]>([]);
  const [pays, setPays] = useState<{ method: string; amount: number }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from("products").select("*").eq("is_active", true).eq("is_service", false).order("name_ar").limit(5000).then(({ data }) => setProducts((data as any) || []));
    sb.from("contacts").select("*").eq("is_active", true).in("type", ["supplier", "both"]).order("name_ar").then(({ data }) => setSuppliers((data as any) || []));
  }, [sb]);

  const prod = (id: string) => products.find((p) => p.id === id);
  const totals = useMemo(() => {
    let sub = 0, vat = 0;
    lines.forEach((l) => { const b = r3(l.qty * l.cost); sub += b; vat += r3((b * l.rate) / 100); });
    return { sub: r3(sub), vat: r3(vat), total: r3(sub + vat) };
  }, [lines]);
  const paid = r3(pays.reduce((s, p) => s + Number(p.amount || 0), 0));

  const serialsOf = (l: L) => l.serialsText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

  async function submit() {
    if (!opBranch) return;
    setErr("");
    if (!supplier) { setErr("اختر المورد"); return; }
    if (!lines.length) { setErr("أضف بنداً واحداً على الأقل"); return; }
    for (const l of lines) {
      if (!l.product_id) { setErr("اختر المنتج لكل بند"); return; }
      const p = prod(l.product_id)!;
      if (p.track_serial && serialsOf(l).length !== l.qty) { setErr(`عدد الأرقام التسلسلية يجب أن يساوي ${l.qty} للمنتج: ${p.name_ar}`); return; }
    }
    setBusy(true);
    const { data, error } = await sb.rpc("create_purchase_invoice", {
      p_branch_id: opBranch, p_contact_id: supplier, p_supplier_invoice_no: invNo || null, p_invoice_date: date, p_due_date: due || null,
      p_lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.qty, unit_price: l.cost, tax_rate: l.rate, serials: prod(l.product_id)?.track_serial ? serialsOf(l) : undefined })),
      p_payments: pays.filter((p) => p.amount > 0), p_notes: notes || null,
    });
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    router.push(`/invoices/${data}`);
  }

  if (!opBranch) return <NeedBranch />;
  return (
    <div>
      <PageHeader title="فاتورة شراء جديدة" />
      <Msg error={err} />
      <div className="card space-y-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div><label className="label">المورد *</label>
            <select className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select></div>
          <div><label className="label">رقم فاتورة المورد</label><input className="input num" value={invNo} onChange={(e) => setInvNo(e.target.value)} /></div>
          <div><label className="label">التاريخ</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">تاريخ الاستحقاق</label><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        {!suppliers.length && <p className="text-sm text-amber-600">لا يوجد موردون. أضف مورداً من صفحة «العملاء والموردون».</p>}
        <table className="tbl">
          <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة (قبل الضريبة)</th><th>ضريبة %</th><th>الإجمالي</th><th></th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const p = prod(l.product_id);
              const set = (patch: Partial<L>) => setLines(lines.map((x) => (x.key === l.key ? { ...x, ...patch } : x)));
              return (
                <tr key={l.key}>
                  <td className="min-w-[220px]">
                    <select className="input" value={l.product_id} onChange={(e) => { const np = prod(e.target.value); set({ product_id: e.target.value, cost: Number(np?.cost_price || 0), rate: Number(np?.tax_rate ?? company.default_vat_rate) }); }}>
                      <option value="">— اختر —</option>{products.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
                    </select>
                    {p?.track_serial && <textarea className="input mt-1 num text-xs" rows={2} placeholder={`أدخل ${l.qty} رقم IMEI (مفصولة بسطر أو فاصلة)`} value={l.serialsText} onChange={(e) => set({ serialsText: e.target.value })} />}
                    {p?.track_serial && <div className="text-xs text-slate-500">المدخل: {serialsOf(l).length} / {l.qty}</div>}
                  </td>
                  <td className="w-24"><input type="number" min={1} step="any" className="input num" value={l.qty} onChange={(e) => set({ qty: Number(e.target.value) })} /></td>
                  <td className="w-36"><input type="number" min={0} step="0.001" className="input num" value={l.cost} onChange={(e) => set({ cost: Number(e.target.value) })} /></td>
                  <td className="w-24"><input type="number" step="0.01" className="input num" value={l.rate} onChange={(e) => set({ rate: Number(e.target.value) })} /></td>
                  <td className="num w-28">{money(r3(l.qty * l.cost) + r3((r3(l.qty * l.cost) * l.rate) / 100))}</td>
                  <td><button className="text-red-500 text-lg" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn btn-sec btn-sm" onClick={() => setLines([...lines, { key: crypto.randomUUID(), product_id: "", qty: 1, cost: 0, rate: Number(company.default_vat_rate), serialsText: "" }])}><I n="plus" /> بند</button>
        <div className="grid sm:grid-cols-2 gap-4 border-t pt-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">دفعات للمورد (اتركها فارغة للشراء الآجل)</div>
            {pays.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select className="input" value={p.method} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input type="number" step="0.001" className="input num" value={p.amount} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
                <button className="text-red-500" onClick={() => setPays(pays.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button className="btn btn-sec btn-sm" onClick={() => setPays([...pays, { method: "cash", amount: Math.max(0, r3(totals.total - paid)) }])}><I n="plus" /> دفعة</button>
            <div><label className="label">ملاحظات</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>المجموع</span><span className="num">{money(totals.sub)}</span></div>
            <div className="flex justify-between"><span>ضريبة المدخلات</span><span className="num">{money(totals.vat)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-1"><span>الإجمالي</span><span className="num">{money(totals.total)}</span></div>
            <div className="flex justify-between"><span>المدفوع</span><span className="num">{money(paid)}</span></div>
            <div className="flex justify-between text-amber-600 font-semibold"><span>المتبقي للمورد</span><span className="num">{money(totals.total - paid)}</span></div>
          </div>
        </div>
        <div className="text-left"><button className="btn btn-ok" disabled={busy} onClick={submit}>{busy ? "…" : "حفظ الفاتورة"}</button></div>
      </div>
    </div>
  );
}
