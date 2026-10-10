"use client";
import { I as Ic } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { errMsg, fdate, fdt, METHODS, money, r3, REPAIR_STATUS, today } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Field, Modal, Msg, PageHeader } from "@/components/ui";
import QuickPurchase from "@/components/QuickPurchase";

const EDITABLE = ["received", "diagnosing", "waiting_approval", "waiting_parts", "in_repair", "ready"];

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>();
  const { sb, can, company } = useApp();
  const [o, setO] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [modal, setModal] = useState<"" | "deposit" | "deliver" | "cancel">("");
  const [dep, setDep] = useState({ amount: 0, method: "cash" });
  const [dpays, setDpays] = useState<{ method: string; amount: number }[]>([{ method: "cash", amount: 0 }]);
  const [np, setNp] = useState({ product_id: "", quantity: 1, unit_price: 0 });
  const [refund, setRefund] = useState("cash");
  const [buy, setBuy] = useState<{ p: Product; qty: number } | null>(null);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      sb.from("repair_orders").select("*, branches(name_ar)").eq("id", id).maybeSingle(),
      sb.from("repair_parts").select("*, products(name_ar)").eq("repair_order_id", id).order("created_at"),
      sb.from("repair_events").select("*").eq("repair_order_id", id).order("created_at", { ascending: false }),
    ]);
    const ord: any = a.data;
    setO(ord); setParts((b.data as any) || []); setEvents((c.data as any) || []);
    if (ord) setF({ diagnosis: ord.diagnosis || "", labor_charge: ord.labor_charge, estimated_cost: ord.estimated_cost, technician_id: ord.technician_id || "", warranty_days: ord.warranty_days, promised_at: ord.promised_at || "", notes: ord.notes || "", status: ord.status });
  }, [sb, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    sb.from("products").select("*").eq("is_active", true).order("name_ar").limit(5000).then(({ data }) => setProducts((data as any) || []));
    sb.from("profiles").select("id,full_name,role").eq("is_active", true).in("role", ["technician", "branch_manager", "admin"]).then(({ data }) => setTechs((data as any) || []));
  }, [sb]);

  if (!o) return <div className="text-slate-500">جاري التحميل…</div>;
  const closed = o.status === "delivered" || o.status === "cancelled";
  const partsTotal = r3(parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0));
  const net = r3(partsTotal + Number(f.labor_charge || 0));
  const vat = r3((net * Number(company.default_vat_rate)) / 100);
  const total = r3(net + vat);
  const due = r3(total - Number(o.deposit_amount));

  async function saveInfo() {
    setErr(""); setOk("");
    const { error } = await sb.from("repair_orders").update({
      diagnosis: f.diagnosis || null, labor_charge: Number(f.labor_charge) || 0, estimated_cost: Number(f.estimated_cost) || 0,
      technician_id: f.technician_id || null, warranty_days: Number(f.warranty_days) || 0, promised_at: f.promised_at || null, notes: f.notes || null, status: f.status,
    }).eq("id", id);
    if (error) { setErr(errMsg(error)); return; }
    setOk("تم الحفظ"); load();
  }
  async function addPart() {
    setErr("");
    const prod = products.find((p) => p.id === np.product_id);
    if (prod && !prod.is_service) {
      const { data: bs } = await sb.from("branch_stock").select("quantity").eq("branch_id", o.branch_id).eq("product_id", prod.id).maybeSingle();
      const have = Number((bs as any)?.quantity || 0);
      const used = parts.filter((x) => x.product_id === prod.id).reduce((s, x) => s + Number(x.quantity), 0);
      if (have - used < np.quantity) { setBuy({ p: prod, qty: np.quantity - (have - used) }); return; }
    }
    const { error } = await sb.from("repair_parts").insert({ repair_order_id: id, product_id: np.product_id, quantity: np.quantity, unit_price: np.unit_price });
    if (error) { setErr(errMsg(error)); return; }
    setNp({ product_id: "", quantity: 1, unit_price: 0 }); load();
  }
  async function delPart(pid: string) {
    const { error } = await sb.from("repair_parts").delete().eq("id", pid);
    if (error) setErr(errMsg(error)); else load();
  }
  async function addDeposit() {
    const { error } = await sb.rpc("repair_add_deposit", { p_order_id: id, p_amount: Number(dep.amount), p_method: dep.method });
    if (error) { setErr(errMsg(error)); return; }
    setModal(""); setOk("تم تسجيل العربون"); load();
  }
  async function deliver() {
    setErr("");
    // persist latest charges first
    const s = await sb.from("repair_orders").update({ labor_charge: Number(f.labor_charge) || 0, diagnosis: f.diagnosis || null }).eq("id", id);
    if (s.error) { setErr(errMsg(s.error)); return; }
    const { data, error } = await sb.rpc("repair_deliver", { p_order_id: id, p_payments: dpays.filter((p) => Number(p.amount) > 0), p_invoice_date: today() });
    if (error) { setErr(errMsg(error)); return; }
    setModal(""); window.open(`/print/invoice/${data}?fmt=a4&auto=1`, "_blank"); load();
  }
  async function cancel() {
    const { error } = await sb.rpc("cancel_repair_order", { p_order_id: id, p_refund_method: refund });
    if (error) { setErr(errMsg(error)); return; }
    setModal(""); setOk("تم إلغاء الأمر"); load();
  }

  return (
    <div>
      <PageHeader title={`أمر صيانة ${o.order_no}`}>
        <a className="btn btn-sec" target="_blank" href={`/print/repair/${id}?auto=1`}>طباعة إيصال الاستلام</a>
        {o.invoice_id && <a className="btn btn-sec" href={`/invoices/${o.invoice_id}`}>فاتورة التسليم</a>}
        {!closed && <button className="btn btn-sec" onClick={() => { setDep({ amount: 0, method: "cash" }); setModal("deposit"); }}><Ic n="plus" /> عربون</button>}
        {!closed && can("admin", "accountant", "branch_manager", "cashier") && <button className="btn btn-ok" onClick={() => { setDpays([{ method: "cash", amount: Math.max(0, due) }]); setModal("deliver"); }}>تسليم وفوترة</button>}
        {!closed && can("admin", "accountant", "branch_manager") && <button className="btn btn-danger" onClick={() => setModal("cancel")}>إلغاء</button>}
      </PageHeader>
      <Msg error={modal ? "" : err} ok={ok} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card grid sm:grid-cols-3 gap-3 text-sm">
            <I l="العميل" v={o.customer_name} /><I l="الهاتف" v={o.customer_phone} /><I l="الفرع" v={o.branches?.name_ar} />
            <I l="الجهاز" v={[o.device_type, o.brand, o.model].filter(Boolean).join(" ")} /><I l="IMEI/السيريال" v={o.serial_no} /><I l="تاريخ الاستلام" v={fdt(o.received_at)} />
            <div className="sm:col-span-3"><I l="العطل المبلّغ عنه" v={o.problem_ar} /></div>
            <I l="الملحقات" v={o.accessories_received} /><I l="حالة الجهاز" v={o.condition_notes} /><I l="العربون المدفوع" v={money(o.deposit_amount)} />
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold">التشخيص والتكلفة</h3>
            <Msg error={err} />
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="الحالة"><select className="input" disabled={closed} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                {(closed ? Object.keys(REPAIR_STATUS) : EDITABLE).map((k) => <option key={k} value={k}>{REPAIR_STATUS[k]}</option>)}</select></Field>
              <Field label="الفني"><select className="input" disabled={closed} value={f.technician_id} onChange={(e) => setF({ ...f, technician_id: e.target.value })}><option value="">—</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
              <Field label="موعد التسليم"><input type="date" disabled={closed} className="input" value={f.promised_at} onChange={(e) => setF({ ...f, promised_at: e.target.value })} /></Field>
              <Field label="التقدير الأولي"><input type="number" step="0.001" disabled={closed} className="input num" value={f.estimated_cost} onChange={(e) => setF({ ...f, estimated_cost: e.target.value })} /></Field>
              <Field label="أجرة العمل (قبل الضريبة)"><input type="number" step="0.001" disabled={closed} className="input num" value={f.labor_charge} onChange={(e) => setF({ ...f, labor_charge: e.target.value })} /></Field>
              <Field label="ضمان الصيانة (أيام)"><input type="number" disabled={closed} className="input num" value={f.warranty_days} onChange={(e) => setF({ ...f, warranty_days: e.target.value })} /></Field>
              <Field label="التشخيص / العمل المنفّذ" className="sm:col-span-3"><textarea className="input" rows={2} disabled={closed} value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
              <Field label="ملاحظات داخلية" className="sm:col-span-3"><input className="input" disabled={closed} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            </div>
            {!closed && <button className="btn" onClick={saveInfo}>حفظ التعديلات</button>}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold">القطع المستخدمة</h3>
            <table className="tbl"><thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead>
              <tbody>{parts.map((p) => <tr key={p.id}><td>{p.products?.name_ar}</td><td className="num">{Number(p.quantity)}</td><td className="num">{money(p.unit_price)}</td><td className="num">{money(Number(p.quantity) * Number(p.unit_price))}</td>
                <td>{!closed && <button className="text-red-500" onClick={() => delPart(p.id)}>×</button>}</td></tr>)}</tbody></table>
            {!closed && (
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]"><label className="label">قطعة</label>
                  <select className="input" value={np.product_id} onChange={(e) => setNp({ ...np, product_id: e.target.value, unit_price: Number(products.find((p) => p.id === e.target.value)?.sale_price || 0) })}>
                    <option value="">—</option>{products.filter((p) => !p.is_service && !p.track_serial).map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></div>
                <div className="w-20"><label className="label">كمية</label><input type="number" min={1} className="input num" value={np.quantity} onChange={(e) => setNp({ ...np, quantity: Number(e.target.value) })} /></div>
                <div className="w-28"><label className="label">السعر</label><input type="number" step="0.001" className="input num" value={np.unit_price} onChange={(e) => setNp({ ...np, unit_price: Number(e.target.value) })} /></div>
                <button className="btn" disabled={!np.product_id} onClick={addPart}>إضافة</button>
              </div>
            )}
            <p className="text-xs text-slate-500">تُخصم القطع من مخزون الفرع عند التسليم والفوترة. القطع ذات الرقم التسلسلي لا تُضاف هنا — أصدر فاتورة بيع مستقلة لها.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card text-sm space-y-1">
            <h3 className="font-semibold mb-2">ملخص الفاتورة المتوقعة</h3>
            <R l="قطع الغيار" v={money(partsTotal)} /><R l="أجرة العمل" v={money(f.labor_charge)} />
            <R l={`ضريبة ${company.default_vat_rate}%`} v={money(vat)} />
            <div className="border-t pt-1"><R l="الإجمالي" v={money(total)} bold /></div>
            <R l="العربون" v={money(o.deposit_amount)} />
            <div className="text-amber-600"><R l="المتبقي عند التسليم" v={money(due)} bold /></div>
          </div>
          <div className="card text-sm">
            <h3 className="font-semibold mb-2">سجل الحالة</h3>
            <ul className="space-y-2">{events.map((e) => <li key={e.id} className="border-s-2 border-brand-500 ps-2"><div className="font-medium">{REPAIR_STATUS[e.status] || e.status}</div><div className="text-xs text-slate-500">{fdt(e.created_at)}</div>{e.note && <div className="text-xs">{e.note}</div>}</li>)}</ul>
          </div>
        </div>
      </div>

      {buy && <QuickPurchase product={buy.p} needQty={buy.qty} branchId={o.branch_id} onClose={() => setBuy(null)} onDone={() => { setBuy(null); addPart(); }} />}
      {modal === "deposit" && (
        <Modal title="إضافة عربون" onClose={() => setModal("")}>
          <div className="space-y-3"><Msg error={err} />
            <Field label="المبلغ"><input type="number" step="0.001" className="input num" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: Number(e.target.value) })} /></Field>
            <Field label="الطريقة"><select className="input" value={dep.method} onChange={(e) => setDep({ ...dep, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <button className="btn w-full" onClick={addDeposit}><Ic n="save" /> حفظ</button></div>
        </Modal>
      )}
      {modal === "deliver" && (
        <Modal title="تسليم الجهاز وإصدار الفاتورة" onClose={() => setModal("")}>
          <div className="space-y-3"><Msg error={err} />
            <p className="text-sm">يجب أن تكون الحالة «جاهز للتسليم». الإجمالي <b className="num">{money(total)}</b> — العربون <b className="num">{money(o.deposit_amount)}</b> — المطلوب <b className="num">{money(due)}</b></p>
            {dpays.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select className="input" value={p.method} onChange={(e) => setDpays(dpays.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input type="number" step="0.001" className="input num" value={p.amount} onChange={(e) => setDpays(dpays.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
              </div>))}
            <button className="btn btn-sec btn-sm" onClick={() => setDpays([...dpays, { method: "card", amount: 0 }])}><Ic n="plus" /> طريقة دفع</button>
            <button className="btn btn-ok w-full" onClick={deliver}>تأكيد التسليم</button></div>
        </Modal>
      )}
      {modal === "cancel" && (
        <Modal title="إلغاء أمر الصيانة" onClose={() => setModal("")}>
          <div className="space-y-3"><Msg error={err} />
            <p className="text-sm text-slate-600">سيُرد العربون ({money(o.deposit_amount)}) للعميل بالطريقة المختارة.</p>
            <Field label="طريقة رد العربون"><select className="input" value={refund} onChange={(e) => setRefund(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <button className="btn btn-danger w-full" onClick={cancel}>تأكيد الإلغاء</button></div>
        </Modal>
      )}
    </div>
  );
}
const I = ({ l, v }: { l: string; v?: string | null }) => <div><div className="text-xs text-slate-500">{l}</div><div className="font-medium">{v || "—"}</div></div>;
const R = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span>{l}</span><span className="num">{v}</span></div>;
