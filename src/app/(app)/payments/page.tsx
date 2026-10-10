"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, fdate, METHODS, money, r3, today } from "@/lib/format";
import { Empty, Field, Msg, NeedBranch, PageHeader, usePaged } from "@/components/ui";

export default function Payments() {
  const { sb, opBranch, branchId, branches, can } = useApp();
  const [contacts, setContacts] = useState<any[]>([]);
  const [dir, setDir] = useState<"in" | "out">("in");
  const [contact, setContact] = useState("");
  const [open, setOpen] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [f, setF] = useState({ method: "cash", amount: 0, reference: "", date: today() });
  const [hist, setHist] = useState<any[]>([]);
  const pg = usePaged(hist);
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");

  const loadHist = useCallback(() => {
    let q = sb.from("payments").select("*, contacts(name_ar)").order("created_at", { ascending: false }).limit(200);
    if (branchId !== "all") q = q.eq("branch_id", branchId);
    q.then(({ data }) => setHist((data as any) || []));
  }, [sb, branchId]);
  useEffect(loadHist, [loadHist]);
  useEffect(() => { sb.from("contacts").select("id,name_ar,type").eq("is_active", true).order("name_ar").then(({ data }) => setContacts((data as any) || [])); }, [sb]);
  useEffect(() => {
    setSel([]);
    if (!contact) { setOpen([]); return; }
    sb.from("invoices").select("*").eq("contact_id", contact).eq("kind", dir === "in" ? "sales" : "purchase").in("status", ["confirmed", "partially_paid"]).order("invoice_date").then(({ data }) => setOpen((data as any) || []));
  }, [sb, contact, dir]);
  useEffect(() => {
    const tot = r3(open.filter((i) => sel.includes(i.id)).reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0));
    if (sel.length) setF((x) => ({ ...x, amount: tot }));
  }, [sel, open]);

  async function save() {
    if (!opBranch) return;
    setErr(""); setOk("");
    const { error } = await sb.rpc("record_payment", { p_branch_id: opBranch, p_contact_id: contact, p_direction: dir, p_payment_date: f.date, p_method: f.method, p_amount: Number(f.amount), p_reference: f.reference || null, p_invoice_ids: sel.length ? sel : null });
    if (error) { setErr(errMsg(error)); return; }
    setOk("تم تسجيل السند"); setSel([]); setF({ ...f, amount: 0, reference: "" }); loadHist();
    setContact((c) => c); // refresh open invoices
    const { data } = await sb.from("invoices").select("*").eq("contact_id", contact).eq("kind", dir === "in" ? "sales" : "purchase").in("status", ["confirmed", "partially_paid"]).order("invoice_date");
    setOpen((data as any) || []);
  }
  if (!opBranch) return <NeedBranch />;
  return (
    <div>
      <PageHeader title="سندات القبض والصرف" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <Msg error={err} ok={ok} />
          <div className="flex gap-2">
            <button className={`btn ${dir === "in" ? "" : "btn-sec"}`} onClick={() => { setDir("in"); setContact(""); }}>سند قبض (من عميل)</button>
            <button className={`btn ${dir === "out" ? "" : "btn-sec"}`} onClick={() => { setDir("out"); setContact(""); }}>سند صرف (لمورد)</button>
          </div>
          <Field label={dir === "in" ? "العميل" : "المورد"}><select className="input" value={contact} onChange={(e) => setContact(e.target.value)}>
            <option value="">—</option>{contacts.filter((c) => dir === "in" ? c.type !== "supplier" : c.type !== "customer").map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select></Field>
          {open.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-auto">
              {open.map((i) => (
                <label key={i.id} className="flex items-center gap-2 px-3 py-2 border-b text-sm">
                  <input type="checkbox" checked={sel.includes(i.id)} onChange={(e) => setSel(e.target.checked ? [...sel, i.id] : sel.filter((x) => x !== i.id))} />
                  <span className="num">{i.invoice_number}</span><span>{fdate(i.invoice_date)}</span><span className="mr-auto num">{money(Number(i.total) - Number(i.amount_paid))}</span>
                </label>))}
            </div>)}
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ"><input type="number" step="0.001" className="input num" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
            <Field label="الطريقة"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="التاريخ"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="مرجع"><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          </div>
          <p className="text-xs text-slate-500">حدّد فواتير لتخصيص الدفعة عليها، أو اتركها بدون تحديد ليتم توزيعها تلقائياً.</p>
          <button className="btn w-full" disabled={!contact || !can("admin", "accountant", "branch_manager")} onClick={save}>حفظ السند</button>
        </div>
        <div className="card overflow-x-auto">
          <h3 className="font-semibold mb-2">آخر السندات</h3>
          <table className="tbl"><thead><tr><th>التاريخ</th><th>الجهة</th><th>النوع</th><th>المبلغ</th><th></th></tr></thead>
            <tbody>{pg.rows.map((h) => (
              <tr key={h.id} className={h.voided ? "opacity-40 line-through" : ""}>
                <td>{fdate(h.payment_date)}</td><td>{h.contacts?.name_ar}</td><td>{h.direction === "in" ? "قبض" : "صرف"} / {METHODS[h.method]}</td><td className="num">{money(h.amount)}</td>
                <td>{!h.voided && can("admin", "accountant") && <button className="text-red-600 text-xs underline" onClick={async () => {
                  const r = prompt("سبب الإلغاء؟"); if (!r) return;
                  const { error } = await sb.rpc("void_payment", { p_payment_id: h.id, p_reason: r });
                  if (error) setErr(errMsg(error)); else loadHist();
                }}>إلغاء</button>}</td></tr>))}</tbody></table>{pg.bar}
          {!hist.length && <Empty />}
        </div>
      </div>
    </div>
  );
}
