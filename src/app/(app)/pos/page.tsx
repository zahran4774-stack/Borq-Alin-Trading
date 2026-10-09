"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, METHODS, money, r3, today } from "@/lib/format";
import type { Contact, Product } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Modal, Msg, NeedBranch, PageHeader } from "@/components/ui";
import QuickPurchase from "@/components/QuickPurchase";

type Line = {
  key: string; product_id: string | null; name: string; qty: number; price: number; discount: number;
  tax_rate: number; track_serial: boolean; serials: string[]; stock: number | null; is_service: boolean;
};
type Pay = { method: string; amount: number };

export default function POS() {
  const { sb, opBranch, company, can } = useApp();
  const { lang } = useLang();
  const pname = (p: Product) => (lang === "en" && p.name_en ? p.name_en : p.name_ar);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [avail, setAvail] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customer, setCustomer] = useState("");
  const [pays, setPays] = useState<Pay[]>([{ method: "cash", amount: 0 }]);
  const [payTouched, setPayTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; no: string } | null>(null);
  const [serialIn, setSerialIn] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState(false);
  const [buy, setBuy] = useState<{ p: Product; qty: number; add: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!opBranch) return;
    const [p, s, c] = await Promise.all([
      sb.from("products").select("*").eq("is_active", true).order("name_ar").limit(5000),
      sb.from("branch_stock").select("product_id,quantity").eq("branch_id", opBranch).limit(10000),
      sb.from("contacts").select("*").eq("is_active", true).in("type", ["customer", "both"]).order("name_ar").limit(5000),
    ]);
    setProducts((p.data as any) || []);
    const m: Record<string, number> = {};
    ((s.data as any[]) || []).forEach((r) => (m[r.product_id] = Number(r.quantity)));
    setStock(m);
    setContacts((c.data as any) || []);
  }, [sb, opBranch]);
  useEffect(() => { load(); }, [load]);

  const walkin = contacts.find((c) => c.code === "CASH");
  useEffect(() => { if (!customer && walkin) setCustomer(walkin.id); }, [walkin, customer]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products.slice(0, 30);
    return products.filter((p) =>
      [p.name_ar, p.sku, p.barcode, p.brand, p.model].some((x) => x && x.toLowerCase().includes(t))
    ).slice(0, 40);
  }, [q, products]);

  async function loadSerials(pid: string) {
    if (!opBranch || avail[pid]) return;
    const { data } = await sb.from("product_serials").select("serial_no").eq("product_id", pid).eq("branch_id", opBranch).eq("status", "in_stock").limit(2000);
    setAvail((a) => ({ ...a, [pid]: ((data as any[]) || []).map((r) => r.serial_no) }));
  }

  function addProduct(p: Product) {
    if (!p.is_service) {
      const inCart = cart.find((l) => l.product_id === p.id)?.qty || 0;
      if ((stock[p.id] ?? 0) - inCart < 1) { setBuy({ p, qty: Math.max(1, inCart + 1 - (stock[p.id] ?? 0)), add: !cart.some((l) => l.product_id === p.id) }); return; }
    }
    setCart((c) => {
      const ex = c.find((l) => l.product_id === p.id);
      if (ex && !p.track_serial) return c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      if (ex && p.track_serial) return c;
      return [...c, {
        key: crypto.randomUUID(), product_id: p.id, name: pname(p), qty: p.track_serial ? 0 : 1, price: Number(p.sale_price),
        discount: 0, tax_rate: Number(p.tax_rate), track_serial: p.track_serial, serials: [], is_service: p.is_service,
        stock: p.is_service ? null : stock[p.id] ?? 0,
      }];
    });
    if (p.track_serial) loadSerials(p.id);
  }

  async function afterBuy() {
    const b = buy; setBuy(null);
    if (!b || !opBranch) return;
    const { data } = await sb.from("branch_stock").select("quantity").eq("branch_id", opBranch).eq("product_id", b.p.id).maybeSingle();
    const qn = Number((data as any)?.quantity || 0);
    setStock((s) => ({ ...s, [b.p.id]: qn }));
    setCart((c) => {
      if (c.some((l) => l.product_id === b.p.id)) return c.map((l) => (l.product_id === b.p.id ? { ...l, stock: qn } : l));
      return [...c, { key: crypto.randomUUID(), product_id: b.p.id, name: pname(b.p), qty: b.p.track_serial ? 0 : 1, price: Number(b.p.sale_price), discount: 0, tax_rate: Number(b.p.tax_rate), track_serial: b.p.track_serial, serials: [], is_service: false, stock: qn }];
    });
    if (b.p.track_serial) loadSerials(b.p.id);
  }

  function onSearchEnter() {
    const t = q.trim();
    if (!t) return;
    const exact = products.find((p) => p.barcode === t || p.sku === t);
    if (exact) { addProduct(exact); setQ(""); return; }
    if (results.length === 1) { addProduct(results[0]); setQ(""); return; }
    // maybe it's an IMEI of a serial item: look it up
    (async () => {
      if (!opBranch) return;
      const { data } = await sb.from("product_serials").select("product_id,serial_no").eq("serial_no", t).eq("branch_id", opBranch).eq("status", "in_stock").maybeSingle();
      const row: any = data;
      if (row) {
        const p = products.find((x) => x.id === row.product_id);
        if (p) {
          await loadSerials(p.id);
          setCart((c) => {
            const ex = c.find((l) => l.product_id === p.id);
            if (ex) return ex.serials.includes(t) ? c : c.map((l) => (l === ex ? { ...l, serials: [...l.serials, t], qty: l.serials.length + 1 } : l));
            return [...c, { key: crypto.randomUUID(), product_id: p.id, name: pname(p), qty: 1, price: Number(p.sale_price), discount: 0, tax_rate: Number(p.tax_rate), track_serial: true, serials: [t], is_service: false, stock: stock[p.id] ?? 0 }];
          });
          setQ("");
        }
      }
    })();
  }

  const upd = (key: string, patch: Partial<Line>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const del = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  function addSerial(l: Line) {
    const s = (serialIn[l.key] || "").trim();
    if (!s) return;
    if (l.serials.includes(s)) { setErr("الرقم مكرر في الفاتورة"); return; }
    const list = avail[l.product_id!];
    if (list && !list.includes(s)) { setErr(`الرقم ${s} غير متوفر في مخزون هذا الفرع`); return; }
    setErr("");
    upd(l.key, { serials: [...l.serials, s], qty: l.serials.length + 1 });
    setSerialIn({ ...serialIn, [l.key]: "" });
  }
  const removeSerial = (l: Line, s: string) => {
    const ns = l.serials.filter((x) => x !== s);
    upd(l.key, { serials: ns, qty: ns.length });
  };

  const totals = useMemo(() => {
    let sub = 0, vat = 0, disc = 0;
    cart.forEach((l) => {
      const base = r3(l.qty * l.price - l.discount);
      sub += base; vat += r3((base * l.tax_rate) / 100); disc += l.discount;
    });
    return { sub: r3(sub), vat: r3(vat), disc: r3(disc), total: r3(sub + vat) };
  }, [cart]);

  // keep single payment row in sync with total until the cashier edits it
  useEffect(() => {
    if (!payTouched) setPays([{ method: pays[0]?.method || "cash", amount: totals.total }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.total, payTouched]);

  const paid = r3(pays.reduce((s, p) => s + Number(p.amount || 0), 0));
  const remaining = r3(totals.total - paid);

  async function submit() {
    if (!opBranch) return;
    setErr("");
    if (!cart.length) { setErr("السلة فارغة"); return; }
    for (const l of cart) {
      if (l.track_serial && l.serials.length === 0) { setErr(`أدخل الرقم التسلسلي/IMEI للمنتج: ${l.name}`); return; }
      if (l.qty <= 0) { setErr(`كمية غير صحيحة: ${l.name}`); return; }
      if (!l.is_service && l.product_id && l.stock !== null && l.qty > l.stock) {
        const p = products.find((x) => x.id === l.product_id);
        setErr(`الكمية أكبر من المتوفر للمنتج: ${l.name} — أدخل مشترياته أولاً`);
        if (p) setBuy({ p, qty: l.qty - l.stock, add: false });
        return;
      }
    }
    setBusy(true);
    const { data, error } = await sb.rpc("create_sales_invoice", {
      p_branch_id: opBranch,
      p_contact_id: customer || null,
      p_invoice_date: date,
      p_due_date: null,
      p_lines: cart.map((l) => ({
        product_id: l.product_id, description_ar: l.product_id ? undefined : l.name,
        quantity: l.qty, unit_price: l.price, discount: l.discount, tax_rate: l.tax_rate,
        serials: l.track_serial ? l.serials : undefined,
      })),
      p_payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })),
      p_notes: notes || null,
      p_repair_order_id: null,
    });
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    const { data: inv } = await sb.from("invoices").select("invoice_number").eq("id", data as string).maybeSingle();
    setDone({ id: data as string, no: (inv as any)?.invoice_number || "" });
  }

  function reset() {
    setDone(null); setCart([]); setPays([{ method: "cash", amount: 0 }]); setPayTouched(false);
    setNotes(""); setSerialIn({}); setAvail({}); setCustomer(walkin?.id || ""); load();
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  if (!opBranch) return <NeedBranch />;
  if (!can("admin", "accountant", "branch_manager", "cashier")) return <Msg error="ليس لديك صلاحية البيع" />;

  return (
    <div>
      <PageHeader title="نقطة البيع">
        <input type="date" lang="en-GB" dir="ltr" className="input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </PageHeader>
      <Msg error={err} />
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Products */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card space-y-3">
            <input ref={searchRef} autoFocus className="input" placeholder="ابحث بالاسم / الباركود / SKU / IMEI ثم Enter"
              value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearchEnter()} />
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-auto">
              {results.map((p) => {
                const st = stock[p.id] ?? 0;
                return (
                  <button key={p.id} onClick={() => addProduct(p)} className="text-right border rounded-lg p-2 hover:bg-brand-50 hover:border-brand-500">
                    <div className="text-sm font-medium leading-tight">{pname(p)}</div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="num font-bold text-brand-700">{money(p.sale_price)}</span>
                      {!p.is_service && <span className={st <= 0 ? "text-red-600" : "text-slate-500"}>{st} متوفر</span>}
                    </div>
                  </button>
                );
              })}
              {!results.length && <div className="col-span-2 text-center text-slate-400 py-6 text-sm">لا نتائج</div>}
            </div>
            <button className="btn btn-sec btn-sm" onClick={() => setCustom(true)}><I n="plus" /> بند خدمة/مبلغ حر</button>
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-3 space-y-3">
          <div className="card space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">العميل</label>
                <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name_ar}{c.phone ? ` — ${c.phone}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ملاحظات</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>خصم</th><th>الإجمالي</th><th></th></tr></thead>
                <tbody>
                  {cart.map((l) => {
                    const base = r3(l.qty * l.price - l.discount);
                    return (
                      <tr key={l.key}>
                        <td className="min-w-[180px]">
                          <div className="font-medium">{l.name}</div>
                          {l.stock !== null && l.qty > l.stock && !l.track_serial && (
                            <div className="text-xs text-red-600">الكمية أكبر من المتوفر ({l.stock}) — <button className="underline font-bold" onClick={() => { const p = products.find((x) => x.id === l.product_id); if (p) setBuy({ p, qty: l.qty - (l.stock ?? 0), add: false }); }}>إدخال مشتريات</button></div>)}
                          {l.track_serial && (
                            <div className="mt-1 space-y-1">
                              <div className="flex gap-1">
                                <input className="input !py-1 num" list={`dl-${l.key}`} placeholder="IMEI / سيريال" value={serialIn[l.key] || ""}
                                  onChange={(e) => setSerialIn({ ...serialIn, [l.key]: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSerial(l); } }} />
                                <button className="btn btn-sm" onClick={() => addSerial(l)}>+</button>
                              </div>
                              <datalist id={`dl-${l.key}`}>{(avail[l.product_id!] || []).filter((s) => !l.serials.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
                              <div className="flex flex-wrap gap-1">
                                {l.serials.map((s) => (
                                  <span key={s} className="badge badge-info num cursor-pointer" onClick={() => removeSerial(l, s)}>{s} ×</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="w-20">
                          {l.track_serial ? <span className="num">{l.qty}</span> :
                            <input type="number" min={0} step="any" className="input !py-1 num" value={l.qty} onChange={(e) => upd(l.key, { qty: Number(e.target.value) })} />}
                        </td>
                        <td className="w-28"><input type="number" min={0} step="0.001" className="input !py-1 num" value={l.price} onChange={(e) => upd(l.key, { price: Number(e.target.value) })} /></td>
                        <td className="w-24"><input type="number" min={0} step="0.001" className="input !py-1 num" value={l.discount} onChange={(e) => upd(l.key, { discount: Number(e.target.value) })} /></td>
                        <td className="num w-24">{money(base)}</td>
                        <td><button className="text-red-500 text-lg" onClick={() => del(l.key)}>×</button></td>
                      </tr>
                    );
                  })}
                  {!cart.length && <tr><td colSpan={6} className="text-center text-slate-400 py-8">أضف منتجات من القائمة</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <div className="text-sm font-semibold">الدفع</div>
                {pays.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <select className="input" value={p.method} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                      {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="number" min={0} step="0.001" className="input num" value={p.amount}
                      onChange={(e) => { setPayTouched(true); setPays(pays.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x))); }} />
                    {pays.length > 1 && <button className="text-red-500" onClick={() => setPays(pays.filter((_, j) => j !== i))}>×</button>}
                  </div>
                ))}
                <button className="btn btn-sec btn-sm" onClick={() => { setPayTouched(true); setPays([...pays, { method: "card", amount: Math.max(0, remaining) }]); }}><I n="plus" /> طريقة دفع أخرى</button>
              </div>
              <div className="space-y-1 text-sm">
                <Row l="المجموع قبل الضريبة" v={money(totals.sub)} />
                {totals.disc > 0 && <Row l="إجمالي الخصم (مشمول)" v={money(totals.disc)} />}
                <Row l={`الضريبة`} v={money(totals.vat)} />
                <div className="flex justify-between text-lg font-bold border-t pt-1"><span>الإجمالي</span><span className="num">{money(totals.total)} {company.default_vat_rate ? "" : ""}ر.ع</span></div>
                <Row l="المدفوع" v={money(paid)} />
                <div className={`flex justify-between font-semibold ${remaining > 0 ? "text-amber-600" : remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>{remaining < 0 ? "زيادة في الدفع" : "المتبقي (آجل)"}</span><span className="num">{money(Math.abs(remaining))}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-sec" onClick={reset}>إلغاء السلة</button>
              <button className="btn btn-ok" disabled={busy || !cart.length} onClick={submit}>{busy ? "جاري الحفظ…" : <><I n="check" /> إصدار الفاتورة</>}</button>
            </div>
          </div>
        </div>
      </div>

      {buy && <QuickPurchase product={buy.p} needQty={buy.qty} onClose={() => setBuy(null)} onDone={afterBuy} />}
      {custom && <CustomLine onClose={() => setCustom(false)} defaultVat={company.default_vat_rate} onAdd={(l) => { setCart((c) => [...c, l]); setCustom(false); }} />}

      {done && (
        <Modal title="تم إصدار الفاتورة" onClose={reset}>
          <div className="text-center space-y-4">
            <div className="text-emerald-600 text-lg font-bold">فاتورة رقم {done.no}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <a className="btn" target="_blank" href={`/print/invoice/${done.id}?fmt=thermal&auto=1`}>طباعة إيصال 80mm</a>
              <a className="btn btn-sec" target="_blank" href={`/print/invoice/${done.id}?fmt=a4&auto=1`}><I n="file" /> طباعة A4</a>
              <button className="btn btn-ok" onClick={reset}>عملية بيع جديدة</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{l}</span><span className="num">{v}</span></div>;
}

function CustomLine({ onClose, onAdd, defaultVat }: { onClose: () => void; onAdd: (l: Line) => void; defaultVat: number }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  return (
    <Modal title="بند خدمة / مبلغ حر" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label">الوصف</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">السعر (قبل الضريبة)</label><input type="number" step="0.001" className="input num" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
        <button className="btn w-full" disabled={!name || price <= 0}
          onClick={() => onAdd({ key: crypto.randomUUID(), product_id: null, name, qty: 1, price, discount: 0, tax_rate: Number(defaultVat), track_serial: false, serials: [], stock: null, is_service: true })}>إضافة</button>
      </div>
    </Modal>
  );
}
