"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { errMsg, fdate, fdt, INV_STATUS, METHODS, money, r3, today } from "@/lib/format";
import { Field, Modal, Msg, PageHeader } from "@/components/ui";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { sb, can } = useApp();
  const [inv, setInv] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [pay, setPay] = useState({ method: "cash", amount: 0, reference: "", date: today() });

  const load = useCallback(async () => {
    const [i, l, a] = await Promise.all([
      sb.from("invoices").select("*, contacts(name_ar,phone), branches(name_ar)").eq("id", id).maybeSingle(),
      sb.from("invoice_lines").select("*").eq("invoice_id", id).order("id"),
      sb.from("payment_allocations").select("amount, payments(id,payment_date,method,reference,voided,created_at)").eq("invoice_id", id),
    ]);
    setInv(i.data); setLines((l.data as any) || []); setPays((a.data as any) || []);
    if (i.data) setPay((p) => ({ ...p, amount: r3(Number((i.data as any).total) - Number((i.data as any).amount_paid)) }));
  }, [sb, id]);
  useEffect(() => { load(); }, [load]);

  if (!inv) return <div className="text-slate-500">جاري التحميل…</div>;
  const remaining = r3(Number(inv.total) - Number(inv.amount_paid));
  const isSales = inv.kind === "sales";

  async function doPay() {
    setErr("");
    const { error } = await sb.rpc("record_payment", {
      p_branch_id: inv.branch_id, p_contact_id: inv.contact_id, p_direction: isSales ? "in" : "out",
      p_payment_date: pay.date, p_method: pay.method, p_amount: Number(pay.amount), p_reference: pay.reference || null, p_invoice_ids: [id],
    });
    if (error) { setErr(errMsg(error)); return; }
    setShowPay(false); setOk("تم تسجيل الدفعة"); load();
  }
  async function doCancel() {
    setErr("");
    const { error } = await sb.rpc("cancel_invoice", { p_invoice_id: id, p_reason: reason });
    if (error) { setErr(errMsg(error)); return; }
    setShowCancel(false); setOk("تم إلغاء الفاتورة وعكس القيود والمخزون"); load();
  }

  return (
    <div>
      <PageHeader title={`${isSales ? "فاتورة بيع" : "فاتورة شراء"} ${inv.invoice_number}`}>
        {isSales && <a className="btn" target="_blank" href={`/print/invoice/${id}?fmt=thermal&auto=1`}><I n="printer" /> طباعة 80mm</a>}
        <a className="btn btn-sec" target="_blank" href={`/print/invoice/${id}?fmt=a4&auto=1`}><I n="file" /> طباعة A4</a>
        {inv.status !== "cancelled" && remaining > 0 && can("admin", "accountant", "branch_manager", "cashier") && <button className="btn btn-ok" onClick={() => setShowPay(true)}>{isSales ? "تسجيل تحصيل" : "تسجيل دفعة"}</button>}
        {inv.status !== "cancelled" && can("admin", "accountant", "branch_manager") && <button className="btn btn-danger" onClick={() => setShowCancel(true)}>إلغاء الفاتورة</button>}
      </PageHeader>
      <Msg error={err} ok={ok} />
      <div className="card grid sm:grid-cols-4 gap-3 mb-4 text-sm">
        <Info l={isSales ? "العميل" : "المورد"} v={inv.contacts?.name_ar} />
        <Info l="الفرع" v={inv.branches?.name_ar} />
        <Info l="التاريخ" v={fdate(inv.invoice_date)} />
        <Info l="الحالة" v={INV_STATUS[inv.status]} />
        {inv.supplier_invoice_no && <Info l="رقم فاتورة المورد" v={inv.supplier_invoice_no} />}
        {inv.notes && <Info l="ملاحظات" v={inv.notes} />}
        {inv.cancelled_at && <Info l="سبب الإلغاء" v={`${inv.cancel_reason || ""} (${fdt(inv.cancelled_at)})`} />}
      </div>
      <div className="card overflow-x-auto mb-4">
        <table className="tbl">
          <thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>خصم</th><th>الضريبة</th><th>الصافي</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description_ar}{l.serial_numbers?.length > 0 && <div className="text-xs text-slate-500 num">{l.serial_numbers.join(" , ")}</div>}</td>
                <td className="num">{Number(l.quantity)}</td><td className="num">{money(l.unit_price)}</td>
                <td className="num">{money(l.discount_amount)}</td><td className="num">{money(l.tax_amount)}</td><td className="num">{money(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 mr-auto w-64 text-sm space-y-1">
          <div className="flex justify-between"><span>المجموع</span><span className="num">{money(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span>الضريبة</span><span className="num">{money(inv.tax_amount)}</span></div>
          <div className="flex justify-between font-bold border-t pt-1"><span>الإجمالي</span><span className="num">{money(inv.total)}</span></div>
          {Number(inv.deposit_applied) > 0 && <div className="flex justify-between"><span>عربون مخصوم</span><span className="num">{money(inv.deposit_applied)}</span></div>}
          <div className="flex justify-between"><span>المدفوع</span><span className="num">{money(inv.amount_paid)}</span></div>
          <div className="flex justify-between font-semibold text-amber-600"><span>المتبقي</span><span className="num">{money(remaining)}</span></div>
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold mb-2">الدفعات</h3>
        <table className="tbl">
          <thead><tr><th>التاريخ</th><th>الطريقة</th><th>المبلغ</th><th>المرجع</th><th></th></tr></thead>
          <tbody>
            {pays.map((p, i) => (
              <tr key={i} className={p.payments?.voided ? "opacity-50 line-through" : ""}>
                <td>{fdate(p.payments?.payment_date)}</td><td>{METHODS[p.payments?.method]}</td>
                <td className="num">{money(p.amount)}</td><td>{p.payments?.reference}</td>
                <td>{!p.payments?.voided && inv.status !== "cancelled" && can("admin", "accountant") && (
                  <button className="text-red-600 text-xs underline" onClick={async () => {
                    const r = prompt("سبب إلغاء الدفعة؟"); if (!r) return;
                    const { error } = await sb.rpc("void_payment", { p_payment_id: p.payments.id, p_reason: r });
                    if (error) setErr(errMsg(error)); else { setOk("تم إلغاء الدفعة"); load(); }
                  }}>إلغاء</button>)}</td>
              </tr>
            ))}
            {!pays.length && <tr><td colSpan={5} className="text-center text-slate-400">لا دفعات</td></tr>}
          </tbody>
        </table>
      </div>

      {showPay && (
        <Modal title="تسجيل دفعة" onClose={() => setShowPay(false)}>
          <div className="space-y-3">
            <Msg error={err} />
            <Field label="الطريقة"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="المبلغ"><input type="number" step="0.001" className="input num" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></Field>
            <Field label="التاريخ"><input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
            <Field label="مرجع"><input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <button className="btn w-full" onClick={doPay}><I n="save" /> حفظ</button>
          </div>
        </Modal>
      )}
      {showCancel && (
        <Modal title="إلغاء الفاتورة" onClose={() => setShowCancel(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">سيتم عكس القيد المحاسبي وإرجاع المخزون والأرقام التسلسلية وإلغاء الدفعات المرتبطة.</p>
            <Field label="سبب الإلغاء (إجباري)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <button className="btn btn-danger w-full" disabled={!reason.trim()} onClick={doCancel}>تأكيد الإلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Info({ l, v }: { l: string; v?: string }) {
  return <div><div className="text-xs text-slate-500">{l}</div><div className="font-medium">{v || "—"}</div></div>;
}
